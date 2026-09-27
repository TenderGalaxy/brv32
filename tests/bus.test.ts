import { Bus } from '../src/memory/bus.js'
import { ArrayRAM } from '../src/memory/ram.js'
test('Memory addressing works correctly', function () {
    let bus = new Bus()
    let ram = new ArrayRAM(8)
    bus.addDevice(0, 8, ram)
    bus.write8(0, 123)
    expect(bus.read8(0)).toBe(123)
    expect(() => bus.write8(9, 999)).toThrow()
    bus.write32(3, 1 << 30)
    expect(bus.read32(3)).toBe(1 << 30)
    bus.write16(2, 65534)
    expect(bus.read16(2)).toBe(65534)
    expect(bus.read8(2)).toBe(254)
})
