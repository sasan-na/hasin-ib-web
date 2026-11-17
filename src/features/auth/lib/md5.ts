/**
 * MD5 (RFC 1321), because the login contract needs it and Web Crypto does not offer it.
 *
 * Not used for anything secret: the server hashes the captcha answer with MD5 and compares the result,
 * so the client has to produce the same digest. Do not use this for new security work.
 */

const WORD_BITS = 32;
const WORD_BYTES = 4;
const BITS_PER_BYTE = 8;
const BLOCK_BYTES = 64;
const BLOCK_SHIFT = 6; // log2(BLOCK_BYTES)
const LENGTH_FIELD_BYTES = 8;
const WORDS_PER_BLOCK = 16;
const DIGEST_BYTES = 16;
const ROUNDS = 64;
const ROUNDS_PER_GROUP = 16;
const ROTATIONS_PER_GROUP = 4;
const PAD_MARKER = 0x80;
const WORD_RANGE = 2 ** WORD_BITS;

// Initial chaining values.
const INITIAL_A = 0x67452301;
const INITIAL_B = 0xefcdab89;
const INITIAL_C = 0x98badcfe;
const INITIAL_D = 0x10325476;

// Left-rotation amounts: four per group of sixteen rounds, repeated within the group.
const ROTATIONS: readonly number[] = '7 12 17 22 5 9 14 20 4 11 16 23 6 10 15 21'
    .split(' ')
    .map(Number);

// Message-word index per group: g = (STRIDE * round + OFFSET) mod 16 (group 0 is the round itself).
const SECOND_GROUP_STRIDE = 5;
const THIRD_GROUP_STRIDE = 3;
const THIRD_GROUP_OFFSET = 5;
const FOURTH_GROUP_STRIDE = 7;

// K[i] = floor(2^32 * abs(sin(i + 1))), as defined by the RFC.
const CONSTANTS: readonly number[] = Array.from({ length: ROUNDS }, (_, index) =>
    Math.floor(Math.abs(Math.sin(index + 1)) * WORD_RANGE)
);

const rotateLeft = (value: number, amount: number): number =>
    ((value << amount) | (value >>> (WORD_BITS - amount))) >>> 0;

/** The mixing function and the message-word index for round `index`. */
const mix = (index: number, b: number, c: number, d: number): { f: number; g: number } => {
    const group = Math.floor(index / ROUNDS_PER_GROUP);
    if (group === 0) return { f: (b & c) | (~b & d), g: index };
    if (group === 1) {
        return { f: (d & b) | (~d & c), g: (SECOND_GROUP_STRIDE * index + 1) % WORDS_PER_BLOCK };
    }
    if (group === 2) {
        return {
            f: b ^ c ^ d,
            g: (THIRD_GROUP_STRIDE * index + THIRD_GROUP_OFFSET) % WORDS_PER_BLOCK
        };
    }
    return { f: c ^ (b | ~d), g: (FOURTH_GROUP_STRIDE * index) % WORDS_PER_BLOCK };
};

/** Message plus the 0x80 marker, zero padding and the 64-bit bit length, in whole 64-byte blocks. */
const pad = (input: Uint8Array): Uint8Array => {
    const paddedLength = (((input.length + LENGTH_FIELD_BYTES) >>> BLOCK_SHIFT) + 1) << BLOCK_SHIFT;
    const padded = new Uint8Array(paddedLength);
    padded.set(input);
    padded[input.length] = PAD_MARKER;

    const bitLength = input.length * BITS_PER_BYTE;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - LENGTH_FIELD_BYTES, bitLength % WORD_RANGE, true);
    view.setUint32(paddedLength - WORD_BYTES, Math.floor(bitLength / WORD_RANGE), true);
    return padded;
};

type State = [number, number, number, number];

const processBlock = (state: State, view: DataView, offset: number): State => {
    const words = Array.from({ length: WORDS_PER_BLOCK }, (_, index) =>
        view.getUint32(offset + index * WORD_BYTES, true)
    );
    let [a, b, c, d] = state;

    for (let index = 0; index < ROUNDS; index += 1) {
        const { f, g } = mix(index, b, c, d);
        const sum = (a + f + (CONSTANTS[index] ?? 0) + (words[g] ?? 0)) >>> 0;
        const rotation =
            ROTATIONS[
                Math.floor(index / ROUNDS_PER_GROUP) * ROTATIONS_PER_GROUP +
                    (index % ROTATIONS_PER_GROUP)
            ] ?? 0;
        a = d;
        d = c;
        c = b;
        b = (b + rotateLeft(sum, rotation)) >>> 0;
    }

    const [a0, b0, c0, d0] = state;
    return [(a0 + a) >>> 0, (b0 + b) >>> 0, (c0 + c) >>> 0, (d0 + d) >>> 0];
};

/** The 16-byte MD5 digest of `input`. */
export const md5 = (input: Uint8Array): Uint8Array => {
    const padded = pad(input);
    const view = new DataView(padded.buffer);

    let state: State = [INITIAL_A, INITIAL_B, INITIAL_C, INITIAL_D];
    for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
        state = processBlock(state, view, offset);
    }

    const digest = new Uint8Array(DIGEST_BYTES);
    const out = new DataView(digest.buffer);
    state.forEach((word, index) => {
        out.setUint32(index * WORD_BYTES, word, true);
    });
    return digest;
};
