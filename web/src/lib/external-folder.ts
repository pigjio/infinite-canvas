import localforage from "localforage";

// 成品文件夹：通过 File System Access API（Chrome/Edge）把生成的图片和视频
// 镜像到用户选择的本地目录。目录句柄持久化在 IndexedDB，刷新后仍可重连。

const folderStore = localforage.createInstance({ name: "infinite-canvas", storeName: "external_folder" });
const FOLDER_HANDLE_KEY = "output_folder";
const SETTINGS_KEY = "output_folder_settings";

type ExternalFileHandle = { name: string; kind: "file"; getFile(): Promise<File> };
type ExternalDirectoryHandle = {
    name: string;
    kind: "directory";
    getFileHandle(name: string, options?: { create?: boolean }): Promise<ExternalFileHandle>;
    values(): AsyncIterableIterator<ExternalFileHandle | ExternalDirectoryHandle>;
    queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
};

export type OutputFolderSettings = { autoSave: boolean };

let cachedHandle: ExternalDirectoryHandle | null | undefined;
let cachedSettings: OutputFolderSettings | null = null;

function directoryPicker() {
    return (window as unknown as { showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<ExternalDirectoryHandle> }).showDirectoryPicker;
}

export function isOutputFolderSupported() {
    return typeof directoryPicker() === "function";
}

async function getHandle() {
    if (cachedHandle === undefined) {
        cachedHandle = ((await folderStore.getItem<ExternalDirectoryHandle>(FOLDER_HANDLE_KEY).catch(() => null)) as ExternalDirectoryHandle) || null;
    }
    return cachedHandle;
}

export async function getOutputFolderName() {
    return (await getHandle())?.name || "";
}

export async function getOutputFolderPermission(): Promise<PermissionState | "unavailable"> {
    const handle = await getHandle();
    if (!handle) return "unavailable";
    return (await handle.queryPermission?.({ mode: "readwrite" })) || "prompt";
}

export async function pickOutputFolder() {
    const picker = directoryPicker();
    if (!picker) throw new Error("not-supported");
    const handle = await picker({ mode: "readwrite" });
    cachedHandle = handle;
    await folderStore.setItem(FOLDER_HANDLE_KEY, handle);
    await handle.requestPermission?.({ mode: "readwrite" });
    return handle.name || "";
}

export async function requestOutputFolderPermission() {
    const handle = await getHandle();
    if (!handle) return false;
    return (await handle.requestPermission?.({ mode: "readwrite" })) === "granted";
}

export async function removeOutputFolder() {
    cachedHandle = null;
    await folderStore.removeItem(FOLDER_HANDLE_KEY);
}

export async function getOutputFolderSettings(): Promise<OutputFolderSettings> {
    cachedSettings = cachedSettings || (await folderStore.getItem<OutputFolderSettings>(SETTINGS_KEY).catch(() => null)) || { autoSave: true };
    return cachedSettings;
}

export async function setOutputFolderAutoSave(autoSave: boolean) {
    cachedSettings = { ...(await getOutputFolderSettings()), autoSave };
    await folderStore.setItem(SETTINGS_KEY, cachedSettings);
}

async function writeBlob(handle: ExternalDirectoryHandle, filename: string, blob: Blob) {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await (fileHandle as unknown as { createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }).createWritable();
    await writable.write(blob);
    await writable.close();
}

function timestampName(prefix: string, extension: string) {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeExtension = (extension || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 5)}.${safeExtension}`;
}

/** 静默镜像：未选文件夹、未授权或开关关闭时直接跳过，绝不阻塞生成流程。 */
export async function saveToOutputFolder(prefix: string, source: Blob | string, extension = "") {
    try {
        const settings = await getOutputFolderSettings();
        if (!settings.autoSave) return "";
        const handle = await getHandle();
        if (!handle) return "";
        if ((await handle.queryPermission?.({ mode: "readwrite" })) !== "granted") return "";
        const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
        const urlExtension = typeof source === "string" ? source.split("?")[0].split("#")[0].split(".").pop() || "" : "";
        const filename = timestampName(prefix, extension || urlExtension || blob.type.split("/")[1] || "bin");
        await writeBlob(handle, filename, blob);
        return filename;
    } catch {
        return "";
    }
}
