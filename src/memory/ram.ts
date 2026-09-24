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
}
