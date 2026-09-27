import { type Device } from './bus.js'
export class ArrayRAM implements Device {
    data: Uint8Array
    constructor(size: number) {
        this.data = new Uint8Array(size)
    }
    read8(addr: number) {
        return this.data[addr]
    }
    write8(addr: number, val: number) {
        this.data[addr] = val
    }
    read16(addr: number) {
        return (this.data[addr + 1] << 8) + this.data[addr]
    }
    write16(addr: number, val: number) {
        this.data[addr] = val
        this.data[addr + 1] = val >> 8
    }
    read32(addr: number) {
        return (
            (this.data[addr + 3] << 24) +
            (this.data[addr + 2] << 16) +
            (this.data[addr + 1] << 8) +
            this.data[addr]
        )
    }
    write32(addr: number, val: number) {
        this.data[addr] = val
        this.data[addr + 1] = val >> 8
        this.data[addr + 2] = val >> 16
        this.data[addr + 3] = val >> 24
    }
}
