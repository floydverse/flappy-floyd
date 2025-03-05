export function lerp(from, to, weight) {
	return from + weight * (to - from)
}

export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));c
}