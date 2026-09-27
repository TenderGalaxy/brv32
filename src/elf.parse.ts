export interface ELFSegment {
    type: number
    offset: number
    virtualAddress: number
    physicalAddress: number
    fileSize: number
    memorySize: number
    flags: number
    alignment: number
}

export interface ELFFile {
    entry: number
    segments: ELFSegment[]
}

export function parseELF(data: Uint8Array): ELFFile {
    if (
        data[0] !== 0x7f ||
        data[1] !== 0x45 ||
        data[2] !== 0x4c ||
        data[3] !== 0x46
    ) {
        throw new Error('Not an ELF file')
    }
    if (data[4] !== 1) {
        throw new Error('Not ELF32')
    }
    if (data[5] !== 1) {
        throw new Error('Not little-endian ELF')
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const machine = view.getUint16(0x12, true)
    if (machine !== 0xf3) {
        throw new Error('Not a RISC-V ELF')
    }
    const entry = view.getUint32(0x18, true)
    const off = view.getUint32(0x1c, true)
    const size = view.getUint16(0x2a, true)
    const segments: ELFSegment[] = []
    for (let i = 0; i < view.getUint16(0x2c, true); i++) {
        const offset = off + i * size
        const type = view.getUint32(offset, true)
        if (type !== 1) {
            continue
        }
        segments.push({
            type,
            offset: view.getUint32(offset + 4, true),
            virtualAddress: view.getUint32(offset + 8, true),
            physicalAddress: view.getUint32(offset + 12, true),
            fileSize: view.getUint32(offset + 16, true),
            memorySize: view.getUint32(offset + 20, true),
            flags: view.getUint32(offset + 24, true),
            alignment: view.getUint32(offset + 28, true),
        })
    }
    return {
        entry,
        segments,
    }
}
