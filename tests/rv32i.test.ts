import { RV32I } from '../src/cpu/rv32.js'
import { ArrayRAM } from '../src/memory/ram.js'
import { readFile, readdir } from 'node:fs/promises'
import { parseELF } from '../src/elf.parse.js'
import { Bus } from '../src/memory/bus.js'
//test('Functional ADDI ADD SUB SW LW BEQ JAL', function () {
//})
const program = new Uint32Array([
    0x00500093, 0x00a00113, 0x002081b3, 0x40110233, 0x00302023, 0x00002283,
    0x00328463, 0x00100313, 0x0080006f, 0x00200313,
])
test('Functional ADDI ADD SUB SW LW BEQ JAL', function () {
    let ram = new ArrayRAM(1024)
    for (let i = 0; i < program.length; i++) {
        ram.write32(i * 4, program[i])
    }
    let cpu = new RV32I(ram)
    cpu.pc = 0
    expect(cpu.step()).toBe('0 | addi 1 0 5')
    expect(cpu.step()).toBe('4 | addi 2 0 10')
    expect(cpu.step()).toBe('8 | add 3 1 2')
    expect(cpu.step()).toBe('12 | sub 4 2 1')
    expect(cpu.step()).toBe('16 | sw 3 0 0')
    expect(cpu.step()).toBe('20 | lw 5 0 0')
    expect(cpu.step()).toBe('24 | beq 5 3 8')
    expect(cpu.step()).toBe('32 | jal 0 8')
    expect(
        cpu.xreg[1] + cpu.xreg[2] + cpu.xreg[3] + cpu.xreg[4] + cpu.xreg[5],
    ).toBe(50)
})

test('Official RISC-V Tests', async function () {
    for (const file of await readdir('tests/elf')) {
        let contents = await readFile(`tests/elf/${file}`)
        let forms = parseELF(contents)

        let ram = new ArrayRAM(65536)
        let bus = new Bus()
        const s = 0x80000000
        bus.addDevice(s, s + 65536, ram)
        let cpu = new RV32I(bus)

        for (const segment of forms.segments) {
            const bytes = contents.subarray(
                segment.offset,
                segment.offset + segment.fileSize,
            )
            for (let i = 0; i < bytes.length; i++) {
                bus.write8(segment.virtualAddress + i, bytes[i])
            }
        }
        cpu.pc = forms.entry
        for (let i = 0; i < 1000; i++) {
            console.log(cpu.step())
        }
        console.log(`${file}: timeout`)
    }
})
