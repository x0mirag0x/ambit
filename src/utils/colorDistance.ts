export const SIMILAR_COLOR_DISTANCE = 72;
export const SIMILAR_COLOR_DISTANCE_SQ = SIMILAR_COLOR_DISTANCE * SIMILAR_COLOR_DISTANCE;

export const parseHexColor = (value: string): [number, number, number] | null => {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match) return null;
    const hex = match[1];
    return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
    ];
};

export const colorDistanceSq = (left: [number, number, number], right: [number, number, number]): number => {
    const dr = left[0] - right[0];
    const dg = left[1] - right[1];
    const db = left[2] - right[2];
    return dr * dr + dg * dg + db * db;
};

export const colorsAreSimilar = (left: string, right: string): boolean => {
    const a = parseHexColor(left);
    const b = parseHexColor(right);
    if (!a || !b) return false;
    return colorDistanceSq(a, b) <= SIMILAR_COLOR_DISTANCE_SQ;
};
