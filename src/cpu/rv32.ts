import { type Device } from '../memory/bus.js'
class OOBError extends Error {
    constructor(val: string | number) {
        super(`${val} does not match any known value.`)
    }
}
export class RV32I {
    memory: Device
    mode = 3
    xreg = new Uint32Array(33)
    csr = new Uint32Array(4096)
    get pc() {
        return this.xreg[32]
    }
    set pc(val: number) {
        this.xreg[32] = val
    }
    constructor(memory: Device) {
        this.memory = memory
    }
    step() {
        this.xreg[0] = 0
        return `${this.pc} | ${this.execute()}`
    }
    execute() {
        const instr = this.memory.read32(this.pc >>> 0)
        const opc = this.getOpcode(instr)
        switch (opc) {
            // ADDI/SLTI/SLTIU/ANDI/ORI/XORI
            case 0b0010011:
                return this.opc0010011(instr)
            // LUI
            case 0b0110111:
                return this.opc0110111(instr)
            // AUIPC
            case 0b0010111:
                return this.opc0010111(instr)
            // ADD/SLT/SLTU/AND/OR/XOR/SLL/SRL/SUB/SRA
            case 0b0110011:
                return this.opc0110011(instr)
            // JAL
            case 0b1101111:
                return this.opc1101111(instr)
            //JALR
            case 0b1100111:
                return this.opc1100111(instr)
            // BEQ/BNE/BLT/BGE/BLTU/BGEU
            case 0b1100011:
                return this.opc1100011(instr)
            // LB/LH/LW/LBU/LHU
            case 0b0000011:
                return this.opc0000011(instr)
            // SB/SH/SW
            case 0b0100011:
                return this.opc0100011(instr)
            // Zicsr Instructions
            // CSRRW/CSRRS/CSRRC/CSRRWI/CSRRSI/CSRRCI
            case 0b1110011:
                return this.opc1110011(instr)
            // Zifencei
            // FENCE.I
            case 0b0001111:
                return this.opc0001111(instr)
            // M Extension
            // MUL/MULH/MULHSU/MULHU/DIV/DIVU/REM/REMU
            case 0b0110011:
                return this.opc0110011(instr)
        }
        return false
    }
    opc0001111(instr: number) {
        const funct3 = this.getSlice(instr, 12, 14)
        if (funct3 == 1) {
            this.pc += 4
            return 'fence.i'
        }
        throw new OOBError(funct3)
    }
    opc0010011(opc: number) {
        this.pc += 4
        const { rd, funct3, rs1, imm, uimm } = this.getIType(opc)
        switch (funct3) {
            case 0b000:
                this.xreg[rd] = this.xreg[rs1] + imm
                return `addi ${rd} ${rs1} ${imm}`
            case 0b001:
                this.xreg[rd] = this.xreg[rs1] << (uimm & 31)
                return `slli ${rs1} ${rd}`
            case 0b010:
                this.xreg[rd] = this.toSigned(this.xreg[rs1]) < uimm ? 1 : 0
                return `slti ${rd} ${rs1} ${imm}`
            case 0b011:
                this.xreg[rd] = this.xreg[rs1] < imm ? 1 : 0
                return `sltiu ${rd} ${rs1} ${imm}`
            case 0b100:
                this.xreg[rd] = this.xreg[rs1] ^ imm
                return `xori ${rd} ${rs1} ${imm}`
            case 0b101:
                if ((opc >>> 30) & 1) {
                    this.xreg[rd] = this.xreg[rs1] >>> (uimm & 31)
                    return `srli ${rs1} ${rd}`
                } else {
                    this.xreg[rd] = this.xreg[rs1] >> (uimm & 31)
                    return `srai ${rs1} ${rd}`
                }
            case 0b110:
                this.xreg[rd] = this.xreg[rs1] | imm
                return `ori ${rd} ${rs1} ${imm}`
            case 0b111:
                this.xreg[rd] = this.xreg[rs1] & imm
                return `andi ${rd} ${rs1} ${imm}`
        }
        throw new OOBError(funct3)
    }
    opc0110111(opc: number) {
        this.pc += 4
        const { rd, uimm } = this.getUType(opc)
        this.xreg[rd] = uimm << 12
        return `lui ${rd} ${uimm}`
    }
    opc0010111(opc: number) {
        const { rd, uimm } = this.getUType(opc)
        this.xreg[rd] = this.pc + (uimm << 12)
        this.pc += 4
        return `auipc ${rd} ${uimm}`
    }
    opc0110011(opc: number) {
        function shdo(v: number) {
            return (v & 0x00ff) << 16
        }
        function shup(v: number) {
            return (v & 0xff00) >> 16
        }
        // 1 2 3 4
        // h1 * h2: 1 2 nopi | nan
        // h1 * l2: 2 3 shup | shdo
        // l1 * l2: 3 4 nan | nopi
        this.pc += 4
        const { rd, funct3, rs1, rs2, funct7 } = this.getRType(opc)
        switch (funct3) {
            case 0b000:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] + this.xreg[rs2]
                    return `add ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 0b0100000) {
                    this.xreg[rd] = this.xreg[rs1] - this.xreg[rs2]
                    return `sub ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    let h1 = rs1 >> 16,
                        l1 = rs1 & 65535,
                        h2 = rs2 >> 16,
                        l2 = rs2 & 65535
                    this.xreg[rd] = l1 * l2 + shdo(l2 * h1) + shdo(l1 * h2)
                    return `mul ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b001:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] << (this.xreg[rs2] & 31)
                    return `sll ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    let h1 = this.sext(rs1 >> 16, 16),
                        l1 = rs1 & 65535,
                        h2 = this.sext(rs2 >> 16, 16),
                        l2 = rs2 & 65535
                    this.xreg[rd] = h1 * h2 + shup(l2 * h1) + shup(l1 * h2)
                    return `mulh ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b010:
                if (funct7 == 0) {
                    if (
                        this.toSigned(this.xreg[rs1]) <
                        this.toSigned(this.xreg[rs2])
                    ) {
                        this.xreg[rd] = 1
                    }
                    return `slt ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    let h1 = this.sext(rs1 >> 16, 16),
                        l1 = rs1 & 65535,
                        h2 = rs2 >> 16,
                        l2 = rs2 & 65535
                    this.xreg[rd] = h1 * h2 + shup(l2 * h1) + shup(l1 * h2)
                    return `mulhsu ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b011:
                if (funct7 == 0) {
                    if (this.xreg[rs1] < this.xreg[rs2]) {
                        this.xreg[rd] = 1
                    }
                    return `sltu ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    let h1 = rs1 >> 16,
                        l1 = rs1 & 65535,
                        h2 = rs2 >> 16,
                        l2 = rs2 & 65535
                    this.xreg[rd] = h1 * h2 + shup(l2 * h1) + shup(l1 * h2)
                    return `mulhu ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b100:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] ^ this.xreg[rs2]
                    return `xor ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    this.xreg[rd] =
                        this.toSigned(this.xreg[rs1]) /
                        this.toSigned(this.xreg[rs2])
                    return `div ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b101:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] >>> (this.xreg[rs2] & 31)
                    return `srl ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 0b0100000) {
                    this.xreg[rd] = this.xreg[rs1] >> (this.xreg[rs2] & 31)
                    return `sra ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    this.xreg[rd] = this.xreg[rs1] / this.xreg[rs2]
                    return `divu ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b110:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] | this.xreg[rs2]
                    return `or ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    this.xreg[rd] =
                        this.toSigned(this.xreg[rs1]) %
                        this.toSigned(this.xreg[rs2])
                    return `rem ${rd} ${rs1} ${rs2}`
                }
                break
            case 0b111:
                if (funct7 == 0) {
                    this.xreg[rd] = this.xreg[rs1] & this.xreg[rs2]
                    return `and ${rd} ${rs1} ${rs2}`
                } else if (funct7 == 1) {
                    this.xreg[rd] = this.xreg[rs1] % this.xreg[rs2]
                    return `remu ${rd} ${rs1} ${rs2}`
                }
                break
        }
        throw new OOBError(`${funct3}, ${funct7}`)
    }
    opc1101111(instr: number) {
        const { rd, uimm } = this.getJType(instr)
        const imm = this.sext(uimm, 21)
        this.xreg[rd] = this.pc + 4
        this.pc += imm
        return `jal ${rd} ${imm}`
    }
    opc1100111(instr: number) {
        const { rd, funct3, rs1, imm, uimm } = this.getIType(instr)
        this.xreg[rd] = this.pc + 4
        this.pc = (this.xreg[rs1] + imm) & -2
        return `jalr ${rd} ${rs1} ${imm}`
    }
    opc1100011(instr: number) {
        // BEQ 0 BNE 1 BLT 100 BGE 101 BLTU 110 BGEU 111
        const { funct3, rs1, rs2, uimm } = this.getBType(instr)
        const imm = this.sext(uimm, 13)
        switch (funct3) {
            case 0b000:
                if (this.xreg[rs1] == this.xreg[rs2]) {
                    this.pc += imm
                } else {
                    this.pc += 4
                }
                return `beq ${rs1} ${rs2} ${imm}`
            case 0b001:
                if (this.xreg[rs1] == this.xreg[rs2]) {
                    this.pc += 4
                } else {
                    this.pc += imm
                }
                return `bne ${rs1} ${rs2} ${imm}`
            case 0b100:
                if (
                    this.toSigned(this.xreg[rs1]) <
                    this.toSigned(this.xreg[rs2])
                ) {
                    this.pc += imm
                } else {
                    this.pc += 4
                }
                return `blt ${rs1} ${rs2} ${imm}`
            case 0b101:
                if (
                    this.toSigned(this.xreg[rs1]) <
                    this.toSigned(this.xreg[rs2])
                ) {
                    this.pc += 4
                } else {
                    this.pc += imm
                }
                return `bge ${rs1} ${rs2} ${imm}`
            case 0b110:
                if (this.xreg[rs1] < this.xreg[rs2]) {
                    this.pc += imm
                } else {
                    this.pc += 4
                }
                return `bltu ${rs1} ${rs2} ${imm}`
            case 0b111:
                if (this.xreg[rs1] < this.xreg[rs2]) {
                    this.pc += 4
                } else {
                    this.pc += imm
                }
                return `bgeu ${rs1} ${rs2} ${imm}`
        }
        throw new OOBError(funct3)
    }
    // LB/LH/LW/LBU/LHU
    opc0000011(instr: number) {
        this.pc += 4
        const { rd, imm, rs1, funct3 } = this.getIType(instr)
        const addr = (this.xreg[rs1] + imm) >>> 0
        switch (funct3) {
            case 0b000:
                this.xreg[rd] = this.sext(this.memory.read8(addr), 8)
                return `lb ${rd} ${rs1} ${imm}`
            case 0b001:
                this.xreg[rd] = this.sext(this.memory.read16(addr), 16)
                return `lh ${rd} ${rs1} ${imm}`
            case 0b010:
                this.xreg[rd] = this.memory.read32(addr)
                return `lw ${rd} ${rs1} ${imm}`
            case 0b100:
                this.xreg[rd] = this.memory.read8(addr)
                return `lbu ${rd} ${rs1} ${imm}`
            case 0b101:
                this.xreg[rd] = this.memory.read16(addr)
                return `lhu ${rd} ${rs1} ${imm}`
        }
        throw new OOBError(funct3)
    }
    // SB/SH/SW
    opc0100011(instr: number) {
        this.pc += 4
        const { uimm, rs1, rs2, funct3 } = this.getSType(instr)
        const imm = this.sext(uimm, 12)
        const addr = (this.xreg[rs1] + imm) >>> 0
        switch (funct3) {
            case 0b000:
                this.memory.write8(addr, this.xreg[rs2])
                return `sb ${rs2} ${rs1} ${imm}`
            case 0b001:
                this.memory.write16(addr, this.xreg[rs2])
                return `sh ${rs2} ${rs1} ${imm}`
            case 0b010:
                this.memory.write32(addr, this.xreg[rs2])
                return `sw ${rs2} ${rs1} ${imm}`
        }
        throw new OOBError(funct3)
    }
    opc1110011(instr: number) {
        this.pc += 4
        const { csr, rs1, funct3, rd } = this.getCSRType(instr)
        switch (funct3) {
            case 0b001: {
                let v = this.xreg[rs1]
                if (rd != 0) this.xreg[rd] = this.csr[csr]
                this.csr[csr] = v
                return `csrrw ${rd} ${csr} ${rs1}`
            }
            case 0b010: {
                let v = this.csr[csr]
                if (rs1 != 0) this.csr[csr] |= this.xreg[rs1]
                this.xreg[rd] = v
                return `csrrs ${rd} ${csr} ${rs1}`
            }
            case 0b011: {
                let v = this.csr[csr]
                if (rs1 != 0) this.csr[csr] &= ~this.xreg[rs1]
                this.xreg[rd] = v
                return `csrrc ${rd} ${csr} ${rs1}`
            }
            case 0b101: {
                if (rd != 0) this.xreg[rd] = this.csr[csr]
                this.csr[csr] = rs1
                return `csrrwi ${rd} ${csr} ${rs1}`
            }
            case 0b110: {
                this.xreg[rd] = this.csr[csr]
                if (rs1 != 0) this.csr[csr] |= rs1
                return `csrrsi ${rd} ${csr} ${rs1}`
            }
            case 0b111: {
                this.xreg[rd] = this.csr[csr]
                if (rs1 != 0) this.csr[csr] &= ~rs1
                return `csrrci ${rd} ${csr} ${rs1}`
            }
        }
        throw new OOBError(funct3)
    }

    getOpcode(v: number) {
        return this.getSlice(v, 0, 6)
    }
    getSlice(v: number, start: number, end: number) {
        return (v >>> start) & ((1 << (end - start + 1)) - 1)
    }
    sext(value: number, bits: number) {
        return (value << (32 - bits)) >> (32 - bits)
    }
    toSigned(value: number) {
        return value | 0
    }
    getRType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            funct3: this.getSlice(v, 12, 14),
            rs1: this.getSlice(v, 15, 19),
            rs2: this.getSlice(v, 20, 24),
            funct7: this.getSlice(v, 25, 31),
        }
    }
    getIType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            funct3: this.getSlice(v, 12, 14),
            rs1: this.getSlice(v, 15, 19),
            imm: this.sext(this.getSlice(v, 20, 31), 12),
            uimm: this.getSlice(v, 20, 31),
        }
    }
    getSType(v: number) {
        return {
            uimm: (this.getSlice(v, 25, 31) << 4) | this.getSlice(v, 7, 11),
            rs2: this.getSlice(v, 20, 24),
            rs1: this.getSlice(v, 15, 19),
            funct3: this.getSlice(v, 12, 14),
        }
    }
    getBType(v: number) {
        return {
            funct3: this.getSlice(v, 12, 14),
            rs1: this.getSlice(v, 15, 19),
            rs2: this.getSlice(v, 20, 24),
            uimm:
                (this.getSlice(v, 8, 11) << 1) |
                (this.getSlice(v, 7, 7) << 11) |
                (this.getSlice(v, 25, 30) << 5) |
                (this.getSlice(v, 31, 31) << 12),
        }
    }
    getUType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            uimm: this.getSlice(v, 12, 31),
        }
    }
    getJType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            uimm:
                (this.getSlice(v, 21, 30) << 1) |
                (this.getSlice(v, 12, 19) << 12) |
                (this.getSlice(v, 20, 20) << 11) |
                (this.getSlice(v, 31, 31) << 20),
        }
    }
    getCSRType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            funct3: this.getSlice(v, 12, 14),
            rs1: this.getSlice(v, 15, 19),
            csr: this.getSlice(v, 20, 31),
        }
    }
    getMULType(v: number) {
        return {
            rd: this.getSlice(v, 7, 11),
            funct3: this.getSlice(v, 12, 14),
            rs1: this.getSlice(v, 15, 19),
            rs2: this.getSlice(v, 20, 24),
            funct7: this.getSlice(v, 25, 31),
        }
    }
}
