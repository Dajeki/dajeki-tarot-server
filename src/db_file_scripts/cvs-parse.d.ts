declare global {
	type ITarotCSVRow = {
		id			?: string,
		suitId		?: string,
		name		?: string,
		elementId	?: string,
		cardRank	?: string,
		upright		?: string,
		down		?: string,
	}
}

export default global;