import type { Vector2 } from "./game";

export function lerp(from:number, to:number, weight:number) {
	return from + weight * (to - from)
}

export function clamp(value:number, min:number, max:number) {
	return Math.min(max, Math.max(min, value));
}

export function dot(v1:Vector2, v2:Vector2) {
	return v1.x * v2.x + v1.y * v2.y;
}

export function magnitude(vector:Vector2) {
	return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

export function normalise(vector:Vector2) {
    const length = magnitude(vector);
	if (length === 0) {
		return { x: 0, y: 0 };
	}
    return { x: vector.x / length, y: vector.y / length };
}

export function clampToZero(value:number, epsilon:number = 1e-10) {
    return Math.abs(value) < epsilon ? 0 : value
}
