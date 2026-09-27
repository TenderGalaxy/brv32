export interface Device {
    read8(addr: number): number
    write8(addr: number, val: number): void
    read16(addr: number): number
    write16(addr: number, val: number): void
    read32(addr: number): number
    write32(addr: number, val: number): void
}
export class Bus implements Device {
    devices: {
        start: number
        end: number
        device: Device
    }[] = []
    constructor() {}
    addDevice(start: number, end: number, device: Device) {
        this.devices.push({
            start,
            end,
            device,
        })
    }
    find(addr: number, space = 1) {
        for (let i of this.devices) {
            if (i.start <= addr && addr < i.end - space) {
                return i
            }
        }
        throw new Error(
            `Invalid Memory Address Accessed: ${addr}. Maybe you forgot to add a device?`,
        )
    }
    read8(addr: number) {
        const dev = this.find(addr)
        return dev.device.read8(addr - dev.start)
    }
    write8(addr: number, val: number) {
        const dev = this.find(addr)
        dev.device.write8(addr - dev.start, val)
    }
    read16(addr: number) {
        const dev = this.find(addr, 2)
        return dev.device.read16(addr - dev.start)
    }
    write16(addr: number, val: number) {
        const dev = this.find(addr, 2)
        dev.device.write16(addr - dev.start, val)
    }
    read32(addr: number) {
        const dev = this.find(addr, 4)
        return dev.device.read32(addr - dev.start)
    }
    write32(addr: number, val: number) {
        const dev = this.find(addr, 4)
        dev.device.write32(addr - dev.start, val)
    }
}
