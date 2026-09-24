export interface Device {
    read8(addr: number): number
    write8(addr: number, val: number): void
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
    find(addr: number) {
        for (let i of this.devices) {
            if (i.start <= addr && addr < i.end) {
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
}
