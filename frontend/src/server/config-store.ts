import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod as nodeChmod,
  lstat as nodeLstat,
  open as nodeOpen,
} from "node:fs/promises";

import writeFileAtomic from "write-file-atomic";

import {
  AppConfigV1Schema,
  type AppConfigV1,
} from "../shared/config/schema.js";

export const CONFIG_BYTE_LIMIT = 65_536;
export const CONFIG_FILE_MODE = 0o600;
export const RECOVERY_ATTEMPT_LIMIT = 8;
export const RECOVERY_HEADER_VALUE = "backup-and-replace" as const;

export const CONFIG_STORE_ERROR_CODES = {
  conflict: "CONFIG_CONFLICT",
  invalid: "CONFIG_INVALID",
  io: "CONFIG_IO_ERROR",
  notFound: "CONFIG_NOT_FOUND",
  preconditionRequired: "CONFIG_PRECONDITION_REQUIRED",
  recoveryNotAllowed: "CONFIG_RECOVERY_NOT_ALLOWED",
  serializedTooLarge: "CONFIG_SERIALIZED_TOO_LARGE",
  tooLarge: "CONFIG_TOO_LARGE",
  unsafeFile: "CONFIG_UNSAFE_FILE",
  versionUnsupported: "CONFIG_VERSION_UNSUPPORTED",
} as const;

export type ConfigStoreErrorCode =
  (typeof CONFIG_STORE_ERROR_CODES)[keyof typeof CONFIG_STORE_ERROR_CODES];

export class ConfigStoreFailure extends Error {
  override readonly name = "ConfigStoreFailure";

  constructor(
    readonly code: ConfigStoreErrorCode,
    readonly etag?: string,
  ) {
    super("The local profile configuration operation failed.");
  }
}

interface FileMetadata {
  readonly dev?: number;
  readonly ino?: number;
  readonly size: number;
  isFile(): boolean;
}

export interface ConfigFileHandle {
  close(): Promise<void>;
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ bytesRead: number }>;
  stat(): Promise<FileMetadata>;
  sync(): Promise<void>;
  writeFile(data: Uint8Array): Promise<void>;
}

export interface ConfigStoreIo {
  lstat(targetPath: string): Promise<FileMetadata>;
  open(
    targetPath: string,
    flags: string | number,
    mode?: number,
  ): Promise<ConfigFileHandle>;
  writeAtomic(
    targetPath: string,
    data: Uint8Array,
    options: { readonly fsync: true; readonly mode: number },
  ): Promise<void>;
}

export type ConfigModeAdapter = (
  targetPath: string,
  mode: number,
) => Promise<void>;

export interface ConfigStoreDependencies {
  readonly applyMode?: ConfigModeAdapter;
  readonly io?: Partial<ConfigStoreIo>;
  readonly now?: () => Date;
  readonly randomBytes?: (size: number) => Buffer;
  readonly noFollowOpenFlag?: number;
}

export interface SaveConfigOptions {
  readonly ifMatch?: string;
  readonly ifNoneMatch?: string;
  readonly recovery?: string;
}

export interface StoredConfig {
  readonly config: AppConfigV1;
  readonly etag: string;
}

type CurrentConfigState =
  | { readonly kind: "missing" }
  | { readonly kind: "unsafe" }
  | { readonly kind: "too-large" }
  | {
      readonly kind: "invalid";
      readonly bytes: Buffer;
      readonly etag: string;
    }
  | {
      readonly kind: "future-version";
      readonly etag: string;
    }
  | {
      readonly kind: "valid";
      readonly config: AppConfigV1;
      readonly etag: string;
    };

const defaultIo: ConfigStoreIo = {
  async lstat(targetPath) {
    return await nodeLstat(targetPath);
  },
  async open(targetPath, flags, mode) {
    return await nodeOpen(targetPath, flags, mode);
  },
  async writeAtomic(targetPath, data, options) {
    await writeFileAtomic(targetPath, Buffer.from(data), options);
  },
};

function isErrno(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function rawEtag(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return `"sha256-${digest}"`;
}

function isFutureVersion(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === "number" && Number.isInteger(version) && version > 1;
}

function recoveryTimestamp(date: Date): string {
  return date
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z");
}

export function serializeAppConfigV1(config: AppConfigV1): Buffer {
  return Buffer.from(`${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function computeConfigEtag(bytes: Uint8Array): string {
  return rawEtag(bytes);
}

export class ConfigStore {
  readonly #targetPath: string;
  readonly #io: ConfigStoreIo;
  readonly #applyMode: ConfigModeAdapter;
  readonly #now: () => Date;
  readonly #randomBytes: (size: number) => Buffer;
  readonly #noFollowOpenFlag: number;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(targetPath: string, dependencies: ConfigStoreDependencies = {}) {
    this.#targetPath = targetPath;
    this.#io = { ...defaultIo, ...dependencies.io };
    this.#applyMode = dependencies.applyMode ?? nodeChmod;
    this.#now = dependencies.now ?? (() => new Date());
    this.#randomBytes = dependencies.randomBytes ?? nodeRandomBytes;
    this.#noFollowOpenFlag =
      dependencies.noFollowOpenFlag ??
      (process.platform === "win32" ? 0 : constants.O_NOFOLLOW);
  }

  async load(): Promise<StoredConfig> {
    const state = await this.#readCurrentState();
    switch (state.kind) {
      case "missing":
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.notFound);
      case "invalid":
        throw new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.invalid,
          state.etag,
        );
      case "unsafe":
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.unsafeFile);
      case "too-large":
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.tooLarge);
      case "future-version":
        throw new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.versionUnsupported,
          state.etag,
        );
      case "valid":
        return { config: state.config, etag: state.etag };
    }
  }

  async save(
    config: AppConfigV1,
    options: SaveConfigOptions,
  ): Promise<StoredConfig> {
    const normalized = AppConfigV1Schema.safeParse(config);
    if (!normalized.success) {
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.invalid);
    }

    const hasIfMatch = options.ifMatch !== undefined;
    const hasCreateCondition = options.ifNoneMatch === "*";
    const hasInvalidCreateCondition =
      options.ifNoneMatch !== undefined && !hasCreateCondition;

    if (
      hasInvalidCreateCondition ||
      hasIfMatch === hasCreateCondition ||
      (options.ifMatch !== undefined && options.ifMatch.length === 0)
    ) {
      throw new ConfigStoreFailure(
        CONFIG_STORE_ERROR_CODES.preconditionRequired,
      );
    }

    const serialized = serializeAppConfigV1(normalized.data);

    return await this.#withMutationLock(async () => {
      const state = await this.#readCurrentState();
      if (state.kind === "unsafe") {
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.unsafeFile);
      }
      if (state.kind === "too-large") {
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.tooLarge);
      }
      if (state.kind === "future-version") {
        throw new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.versionUnsupported,
          state.etag,
        );
      }

      if (state.kind === "missing") {
        if (options.recovery !== undefined) {
          throw new ConfigStoreFailure(
            CONFIG_STORE_ERROR_CODES.recoveryNotAllowed,
          );
        }
        if (!hasCreateCondition) {
          throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.conflict);
        }
      } else if (state.kind === "valid") {
        if (options.recovery !== undefined) {
          throw new ConfigStoreFailure(
            CONFIG_STORE_ERROR_CODES.recoveryNotAllowed,
          );
        }
        if (!hasIfMatch || options.ifMatch !== state.etag) {
          throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.conflict);
        }
      } else {
        if (!hasIfMatch || options.ifMatch !== state.etag) {
          throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.conflict);
        }
        if (options.recovery !== RECOVERY_HEADER_VALUE) {
          throw new ConfigStoreFailure(
            CONFIG_STORE_ERROR_CODES.recoveryNotAllowed,
          );
        }
      }

      if (serialized.byteLength > CONFIG_BYTE_LIMIT) {
        throw new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.serializedTooLarge,
        );
      }

      if (state.kind === "invalid") {
        await this.#writeRecoveryBackup(state.bytes);
      }
      await this.#replaceTarget(serialized);
      return { config: normalized.data, etag: rawEtag(serialized) };
    });
  }

  async #withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  async #readCurrentState(): Promise<CurrentConfigState> {
    let initialMetadata: FileMetadata;
    try {
      initialMetadata = await this.#io.lstat(this.#targetPath);
    } catch (error) {
      if (isErrno(error, "ENOENT")) {
        return { kind: "missing" };
      }
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
    }

    if (!initialMetadata.isFile()) {
      return { kind: "unsafe" };
    }
    if (initialMetadata.size > CONFIG_BYTE_LIMIT) {
      return { kind: "too-large" };
    }

    let handle: ConfigFileHandle;
    try {
      handle = await this.#io.open(
        this.#targetPath,
        constants.O_RDONLY | this.#noFollowOpenFlag,
      );
    } catch (error) {
      if (isErrno(error, "ELOOP")) {
        return { kind: "unsafe" };
      }
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
    }

    let bytes: Buffer;
    let readFailure: ConfigStoreFailure | undefined;
    try {
      const openedMetadata = await handle.stat();
      if (!openedMetadata.isFile()) {
        readFailure = new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.unsafeFile,
        );
        bytes = Buffer.alloc(0);
      } else if (openedMetadata.size > CONFIG_BYTE_LIMIT) {
        readFailure = new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.tooLarge);
        bytes = Buffer.alloc(0);
      } else if (
        initialMetadata.dev !== undefined &&
        initialMetadata.ino !== undefined &&
        openedMetadata.dev !== undefined &&
        openedMetadata.ino !== undefined &&
        (initialMetadata.dev !== openedMetadata.dev ||
          initialMetadata.ino !== openedMetadata.ino)
      ) {
        readFailure = new ConfigStoreFailure(
          CONFIG_STORE_ERROR_CODES.unsafeFile,
        );
        bytes = Buffer.alloc(0);
      } else {
        bytes = await this.#readBounded(handle);
      }
    } catch (error) {
      readFailure =
        error instanceof ConfigStoreFailure
          ? error
          : new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
      bytes = Buffer.alloc(0);
    }

    try {
      await handle.close();
    } catch {
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
    }

    if (readFailure !== undefined) {
      if (readFailure.code === CONFIG_STORE_ERROR_CODES.unsafeFile) {
        return { kind: "unsafe" };
      }
      if (readFailure.code === CONFIG_STORE_ERROR_CODES.tooLarge) {
        return { kind: "too-large" };
      }
      throw readFailure;
    }

    if (bytes.byteLength > CONFIG_BYTE_LIMIT) {
      return { kind: "too-large" };
    }

    const etag = rawEtag(bytes);
    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return { kind: "invalid", bytes, etag };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded) as unknown;
    } catch {
      return { kind: "invalid", bytes, etag };
    }

    if (isFutureVersion(parsed)) {
      return { kind: "future-version", etag };
    }

    const validated = AppConfigV1Schema.safeParse(parsed);
    if (!validated.success) {
      return { kind: "invalid", bytes, etag };
    }

    return { kind: "valid", config: validated.data, etag };
  }

  async #readBounded(handle: ConfigFileHandle): Promise<Buffer> {
    const buffer = Buffer.alloc(CONFIG_BYTE_LIMIT + 1);
    let offset = 0;

    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) {
        break;
      }
      offset += bytesRead;
    }

    return buffer.subarray(0, offset);
  }

  async #replaceTarget(serialized: Buffer): Promise<void> {
    try {
      await this.#io.writeAtomic(this.#targetPath, serialized, {
        fsync: true,
        mode: CONFIG_FILE_MODE,
      });
    } catch {
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
    }

    await this.#applyModeBestEffort(this.#targetPath);
  }

  async #writeRecoveryBackup(bytes: Buffer): Promise<void> {
    let timestamp: string;
    try {
      timestamp = recoveryTimestamp(this.#now());
    } catch {
      throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
    }

    for (let attempt = 0; attempt < RECOVERY_ATTEMPT_LIMIT; attempt += 1) {
      let suffix: string;
      try {
        suffix = this.#randomBytes(4).toString("hex");
      } catch {
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
      }
      if (!/^[0-9a-f]{8}$/u.test(suffix)) {
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
      }
      const backupPath = `${this.#targetPath}.invalid-${timestamp}-${suffix}.bak`;
      let handle: ConfigFileHandle;

      try {
        handle = await this.#io.open(backupPath, "wx", CONFIG_FILE_MODE);
      } catch (error) {
        if (isErrno(error, "EEXIST")) {
          continue;
        }
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
      }

      try {
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close();
      } catch {
        try {
          await handle.close();
        } catch {
          // Preserve the safe I/O category from the backup failure.
        }
        throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
      }

      await this.#applyModeBestEffort(backupPath);
      return;
    }

    throw new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
  }

  async #applyModeBestEffort(targetPath: string): Promise<void> {
    try {
      await this.#applyMode(targetPath, CONFIG_FILE_MODE);
    } catch {
      // Atomic/open modes are authoritative. Reapplication is best effort,
      // including on Windows where the current-account ACL is the boundary.
    }
  }
}

export function createConfigStore(
  targetPath: string,
  dependencies?: ConfigStoreDependencies,
): ConfigStore {
  return new ConfigStore(targetPath, dependencies);
}
