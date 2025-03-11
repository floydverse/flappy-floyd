export function lerp(from:number, to:number, weight:number) {
	return from + weight * (to - from)
}

export function clamp(value:number, min:number, max:number) {
	return Math.min(max, Math.max(min, value));
}

export function clampToZero(value:number, epsilon:number = 1e-10) {
	return Math.abs(value) < epsilon ? 0 : value
}

export class Vector2 {
	x:number
	y:number

	constructor(x:number, y:number) {
		this.x = x;
		this.y = y;
	}

	static dot(v1:Vector2, v2:Vector2) {
		return v1.x * v2.x + v1.y * v2.y;
	}
	
	static magnitude(vector:Vector2) {
		return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	}
	
	static normalise(vector:Vector2) {
		const length = Vector2.magnitude(vector);
		if (length === 0) {
			return { x: 0, y: 0 };
		}
		return { x: vector.x / length, y: vector.y / length };
	}
	
	static distance(v1:Vector2, v2:Vector2) {
		const dx = v2.x - v1.x
		const dy = v2.y - v1.y
		return Math.sqrt(dx * dx + dy * dy)	
	}

	static angleTo(v1:Vector2, v2:Vector2) {
		const angle = Math.acos(Vector2.dot(v1, v2) / (Vector2.magnitude(v1) * Vector2.magnitude(v2)));
		return angle;
	}

	static moveForward(v1:Vector2, angle:number, distance:number) {
		return {
			x: v1.x + Math.cos(angle) * distance,
			y: v1.y + Math.sin(angle) * distance
		}
	}	

	// https://github.com/Unity-Technologies/UnityCsReference/blob/master/Runtime/Export/Math/Vector2.cs
	static moveTowards(current:Vector2, target:Vector2, maxDistanceDelta:number) {
		const toVectorX = target.x - current.x;
		const toVectorY = target.y - current.y;

		const sqDist = toVectorX * toVectorX + toVectorY * toVectorY;
		if (sqDist == 0 || (maxDistanceDelta >= 0 && sqDist <= maxDistanceDelta * maxDistanceDelta)) {
			return target;
		}

		const dist = Math.sqrt(sqDist);
		return new Vector2(current.x + toVectorX / dist * maxDistanceDelta,
			current.y + toVectorY / dist * maxDistanceDelta);
	}
}
