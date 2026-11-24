window.__ModuleLoader__.load({ id: "dsh-push-center", factory: (require) => {
var module = { exports: {} };
var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
// \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
// node_modules/qrcode/lib/can-promise.js
var require_can_promise = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function() {
		return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
	};
}));
// node_modules/qrcode/lib/core/utils.js
var require_utils$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	let toSJISFunction;
	const CODEWORDS_COUNT = [
		0,
		26,
		44,
		70,
		100,
		134,
		172,
		196,
		242,
		292,
		346,
		404,
		466,
		532,
		581,
		655,
		733,
		815,
		901,
		991,
		1085,
		1156,
		1258,
		1364,
		1474,
		1588,
		1706,
		1828,
		1921,
		2051,
		2185,
		2323,
		2465,
		2611,
		2761,
		2876,
		3034,
		3196,
		3362,
		3532,
		3706
	];
	/**
	* Returns the QR Code size for the specified version
	*
	* @param  {Number} version QR Code version
	* @return {Number}         size of QR code
	*/
	exports.getSymbolSize = function getSymbolSize(version) {
		if (!version) throw new Error("\"version\" cannot be null or undefined");
		if (version < 1 || version > 40) throw new Error("\"version\" should be in range from 1 to 40");
		return version * 4 + 17;
	};
	/**
	* Returns the total number of codewords used to store data and EC information.
	*
	* @param  {Number} version QR Code version
	* @return {Number}         Data length in bits
	*/
	exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
		return CODEWORDS_COUNT[version];
	};
	/**
	* Encode data with Bose-Chaudhuri-Hocquenghem
	*
	* @param  {Number} data Value to encode
	* @return {Number}      Encoded value
	*/
	exports.getBCHDigit = function(data) {
		let digit = 0;
		while (data !== 0) {
			digit++;
			data >>>= 1;
		}
		return digit;
	};
	exports.setToSJISFunction = function setToSJISFunction(f) {
		if (typeof f !== "function") throw new Error("\"toSJISFunc\" is not a valid function.");
		toSJISFunction = f;
	};
	exports.isKanjiModeEnabled = function() {
		return typeof toSJISFunction !== "undefined";
	};
	exports.toSJIS = function toSJIS(kanji) {
		return toSJISFunction(kanji);
	};
}));
// node_modules/qrcode/lib/core/error-correction-level.js
var require_error_correction_level = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.L = { bit: 1 };
	exports.M = { bit: 0 };
	exports.Q = { bit: 3 };
	exports.H = { bit: 2 };
	function fromString(string) {
		if (typeof string !== "string") throw new Error("Param is not a string");
		switch (string.toLowerCase()) {
			case "l":
			case "low": return exports.L;
			case "m":
			case "medium": return exports.M;
			case "q":
			case "quartile": return exports.Q;
			case "h":
			case "high": return exports.H;
			default: throw new Error("Unknown EC Level: " + string);
		}
	}
	exports.isValid = function isValid(level) {
		return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
	};
	exports.from = function from(value, defaultValue) {
		if (exports.isValid(value)) return value;
		try {
			return fromString(value);
		} catch (e) {
			return defaultValue;
		}
	};
}));
// node_modules/qrcode/lib/core/bit-buffer.js
var require_bit_buffer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function BitBuffer() {
		this.buffer = [];
		this.length = 0;
	}
	BitBuffer.prototype = {
		get: function(index) {
			const bufIndex = Math.floor(index / 8);
			return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
		},
		put: function(num, length) {
			for (let i = 0; i < length; i++) this.putBit((num >>> length - i - 1 & 1) === 1);
		},
		getLengthInBits: function() {
			return this.length;
		},
		putBit: function(bit) {
			const bufIndex = Math.floor(this.length / 8);
			if (this.buffer.length <= bufIndex) this.buffer.push(0);
			if (bit) this.buffer[bufIndex] |= 128 >>> this.length % 8;
			this.length++;
		}
	};
	module.exports = BitBuffer;
}));
// node_modules/qrcode/lib/core/bit-matrix.js
var require_bit_matrix = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helper class to handle QR Code symbol modules
	*
	* @param {Number} size Symbol size
	*/
	function BitMatrix(size) {
		if (!size || size < 1) throw new Error("BitMatrix size must be defined and greater than 0");
		this.size = size;
		this.data = new Uint8Array(size * size);
		this.reservedBit = new Uint8Array(size * size);
	}
	/**
	* Set bit value at specified location
	* If reserved flag is set, this bit will be ignored during masking process
	*
	* @param {Number}  row
	* @param {Number}  col
	* @param {Boolean} value
	* @param {Boolean} reserved
	*/
	BitMatrix.prototype.set = function(row, col, value, reserved) {
		const index = row * this.size + col;
		this.data[index] = value;
		if (reserved) this.reservedBit[index] = true;
	};
	/**
	* Returns bit value at specified location
	*
	* @param  {Number}  row
	* @param  {Number}  col
	* @return {Boolean}
	*/
	BitMatrix.prototype.get = function(row, col) {
		return this.data[row * this.size + col];
	};
	/**
	* Applies xor operator at specified location
	* (used during masking process)
	*
	* @param {Number}  row
	* @param {Number}  col
	* @param {Boolean} value
	*/
	BitMatrix.prototype.xor = function(row, col, value) {
		this.data[row * this.size + col] ^= value;
	};
	/**
	* Check if bit at specified location is reserved
	*
	* @param {Number}   row
	* @param {Number}   col
	* @return {Boolean}
	*/
	BitMatrix.prototype.isReserved = function(row, col) {
		return this.reservedBit[row * this.size + col];
	};
	module.exports = BitMatrix;
}));
// node_modules/qrcode/lib/core/alignment-pattern.js
var require_alignment_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Alignment pattern are fixed reference pattern in defined positions
	* in a matrix symbology, which enables the decode software to re-synchronise
	* the coordinate mapping of the image modules in the event of moderate amounts
	* of distortion of the image.
	*
	* Alignment patterns are present only in QR Code symbols of version 2 or larger
	* and their number depends on the symbol version.
	*/
	const getSymbolSize = require_utils$1().getSymbolSize;
	/**
	* Calculate the row/column coordinates of the center module of each alignment pattern
	* for the specified QR Code version.
	*
	* The alignment patterns are positioned symmetrically on either side of the diagonal
	* running from the top left corner of the symbol to the bottom right corner.
	*
	* Since positions are simmetrical only half of the coordinates are returned.
	* Each item of the array will represent in turn the x and y coordinate.
	* @see {@link getPositions}
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinate
	*/
	exports.getRowColCoords = function getRowColCoords(version) {
		if (version === 1) return [];
		const posCount = Math.floor(version / 7) + 2;
		const size = getSymbolSize(version);
		const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
		const positions = [size - 7];
		for (let i = 1; i < posCount - 1; i++) positions[i] = positions[i - 1] - intervals;
		positions.push(6);
		return positions.reverse();
	};
	/**
	* Returns an array containing the positions of each alignment pattern.
	* Each array's element represent the center point of the pattern as (x, y) coordinates
	*
	* Coordinates are calculated expanding the row/column coordinates returned by {@link getRowColCoords}
	* and filtering out the items that overlaps with finder pattern
	*
	* @example
	* For a Version 7 symbol {@link getRowColCoords} returns values 6, 22 and 38.
	* The alignment patterns, therefore, are to be centered on (row, column)
	* positions (6,22), (22,6), (22,22), (22,38), (38,22), (38,38).
	* Note that the coordinates (6,6), (6,38), (38,6) are occupied by finder patterns
	* and are not therefore used for alignment patterns.
	*
	* let pos = getPositions(7)
	* // [[6,22], [22,6], [22,22], [22,38], [38,22], [38,38]]
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinates
	*/
	exports.getPositions = function getPositions(version) {
		const coords = [];
		const pos = exports.getRowColCoords(version);
		const posLength = pos.length;
		for (let i = 0; i < posLength; i++) for (let j = 0; j < posLength; j++) {
			if (i === 0 && j === 0 || i === 0 && j === posLength - 1 || i === posLength - 1 && j === 0) continue;
			coords.push([pos[i], pos[j]]);
		}
		return coords;
	};
}));
// node_modules/qrcode/lib/core/finder-pattern.js
var require_finder_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	const getSymbolSize = require_utils$1().getSymbolSize;
	const FINDER_PATTERN_SIZE = 7;
	/**
	* Returns an array containing the positions of each finder pattern.
	* Each array's element represent the top-left point of the pattern as (x, y) coordinates
	*
	* @param  {Number} version QR Code version
	* @return {Array}          Array of coordinates
	*/
	exports.getPositions = function getPositions(version) {
		const size = getSymbolSize(version);
		return [
			[0, 0],
			[size - FINDER_PATTERN_SIZE, 0],
			[0, size - FINDER_PATTERN_SIZE]
		];
	};
}));
// node_modules/qrcode/lib/core/mask-pattern.js
var require_mask_pattern = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Data mask pattern reference
	* @type {Object}
	*/
	exports.Patterns = {
		PATTERN000: 0,
		PATTERN001: 1,
		PATTERN010: 2,
		PATTERN011: 3,
		PATTERN100: 4,
		PATTERN101: 5,
		PATTERN110: 6,
		PATTERN111: 7
	};
	/**
	* Weighted penalty scores for the undesirable features
	* @type {Object}
	*/
	const PenaltyScores = {
		N1: 3,
		N2: 3,
		N3: 40,
		N4: 10
	};
	/**
	* Check if mask pattern value is valid
	*
	* @param  {Number}  mask    Mask pattern
	* @return {Boolean}         true if valid, false otherwise
	*/
	exports.isValid = function isValid(mask) {
		return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
	};
	/**
	* Returns mask pattern from a value.
	* If value is not valid, returns undefined
	*
	* @param  {Number|String} value        Mask pattern value
	* @return {Number}                     Valid mask pattern or undefined
	*/
	exports.from = function from(value) {
		return exports.isValid(value) ? parseInt(value, 10) : void 0;
	};
	/**
	* Find adjacent modules in row/column with the same color
	* and assign a penalty value.
	*
	* Points: N1 + i
	* i is the amount by which the number of adjacent modules of the same color exceeds 5
	*/
	exports.getPenaltyN1 = function getPenaltyN1(data) {
		const size = data.size;
		let points = 0;
		let sameCountCol = 0;
		let sameCountRow = 0;
		let lastCol = null;
		let lastRow = null;
		for (let row = 0; row < size; row++) {
			sameCountCol = sameCountRow = 0;
			lastCol = lastRow = null;
			for (let col = 0; col < size; col++) {
				let module = data.get(row, col);
				if (module === lastCol) sameCountCol++;
				else {
					if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
					lastCol = module;
					sameCountCol = 1;
				}
				module = data.get(col, row);
				if (module === lastRow) sameCountRow++;
				else {
					if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
					lastRow = module;
					sameCountRow = 1;
				}
			}
			if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
			if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
		}
		return points;
	};
	/**
	* Find 2x2 blocks with the same color and assign a penalty value
	*
	* Points: N2 * (m - 1) * (n - 1)
	*/
	exports.getPenaltyN2 = function getPenaltyN2(data) {
		const size = data.size;
		let points = 0;
		for (let row = 0; row < size - 1; row++) for (let col = 0; col < size - 1; col++) {
			const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
			if (last === 4 || last === 0) points++;
		}
		return points * PenaltyScores.N2;
	};
	/**
	* Find 1:1:3:1:1 ratio (dark:light:dark:light:dark) pattern in row/column,
	* preceded or followed by light area 4 modules wide
	*
	* Points: N3 * number of pattern found
	*/
	exports.getPenaltyN3 = function getPenaltyN3(data) {
		const size = data.size;
		let points = 0;
		let bitsCol = 0;
		let bitsRow = 0;
		for (let row = 0; row < size; row++) {
			bitsCol = bitsRow = 0;
			for (let col = 0; col < size; col++) {
				bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
				if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
				bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
				if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
			}
		}
		return points * PenaltyScores.N3;
	};
	/**
	* Calculate proportion of dark modules in entire symbol
	*
	* Points: N4 * k
	*
	* k is the rating of the deviation of the proportion of dark modules
	* in the symbol from 50% in steps of 5%
	*/
	exports.getPenaltyN4 = function getPenaltyN4(data) {
		let darkCount = 0;
		const modulesCount = data.data.length;
		for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
		return Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10) * PenaltyScores.N4;
	};
	/**
	* Return mask value at given position
	*
	* @param  {Number} maskPattern Pattern reference value
	* @param  {Number} i           Row
	* @param  {Number} j           Column
	* @return {Boolean}            Mask value
	*/
	function getMaskAt(maskPattern, i, j) {
		switch (maskPattern) {
			case exports.Patterns.PATTERN000: return (i + j) % 2 === 0;
			case exports.Patterns.PATTERN001: return i % 2 === 0;
			case exports.Patterns.PATTERN010: return j % 3 === 0;
			case exports.Patterns.PATTERN011: return (i + j) % 3 === 0;
			case exports.Patterns.PATTERN100: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
			case exports.Patterns.PATTERN101: return i * j % 2 + i * j % 3 === 0;
			case exports.Patterns.PATTERN110: return (i * j % 2 + i * j % 3) % 2 === 0;
			case exports.Patterns.PATTERN111: return (i * j % 3 + (i + j) % 2) % 2 === 0;
			default: throw new Error("bad maskPattern:" + maskPattern);
		}
	}
	/**
	* Apply a mask pattern to a BitMatrix
	*
	* @param  {Number}    pattern Pattern reference number
	* @param  {BitMatrix} data    BitMatrix data
	*/
	exports.applyMask = function applyMask(pattern, data) {
		const size = data.size;
		for (let col = 0; col < size; col++) for (let row = 0; row < size; row++) {
			if (data.isReserved(row, col)) continue;
			data.xor(row, col, getMaskAt(pattern, row, col));
		}
	};
	/**
	* Returns the best mask pattern for data
	*
	* @param  {BitMatrix} data
	* @return {Number} Mask pattern reference number
	*/
	exports.getBestMask = function getBestMask(data, setupFormatFunc) {
		const numPatterns = Object.keys(exports.Patterns).length;
		let bestPattern = 0;
		let lowerPenalty = Infinity;
		for (let p = 0; p < numPatterns; p++) {
			setupFormatFunc(p);
			exports.applyMask(p, data);
			const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
			exports.applyMask(p, data);
			if (penalty < lowerPenalty) {
				lowerPenalty = penalty;
				bestPattern = p;
			}
		}
		return bestPattern;
	};
}));
// node_modules/qrcode/lib/core/error-correction-code.js
var require_error_correction_code = /* @__PURE__ */ __commonJSMin(((exports) => {
	const ECLevel = require_error_correction_level();
	const EC_BLOCKS_TABLE = [
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		2,
		2,
		1,
		2,
		2,
		4,
		1,
		2,
		4,
		4,
		2,
		4,
		4,
		4,
		2,
		4,
		6,
		5,
		2,
		4,
		6,
		6,
		2,
		5,
		8,
		8,
		4,
		5,
		8,
		8,
		4,
		5,
		8,
		11,
		4,
		8,
		10,
		11,
		4,
		9,
		12,
		16,
		4,
		9,
		16,
		16,
		6,
		10,
		12,
		18,
		6,
		10,
		17,
		16,
		6,
		11,
		16,
		19,
		6,
		13,
		18,
		21,
		7,
		14,
		21,
		25,
		8,
		16,
		20,
		25,
		8,
		17,
		23,
		25,
		9,
		17,
		23,
		34,
		9,
		18,
		25,
		30,
		10,
		20,
		27,
		32,
		12,
		21,
		29,
		35,
		12,
		23,
		34,
		37,
		12,
		25,
		34,
		40,
		13,
		26,
		35,
		42,
		14,
		28,
		38,
		45,
		15,
		29,
		40,
		48,
		16,
		31,
		43,
		51,
		17,
		33,
		45,
		54,
		18,
		35,
		48,
		57,
		19,
		37,
		51,
		60,
		19,
		38,
		53,
		63,
		20,
		40,
		56,
		66,
		21,
		43,
		59,
		70,
		22,
		45,
		62,
		74,
		24,
		47,
		65,
		77,
		25,
		49,
		68,
		81
	];
	const EC_CODEWORDS_TABLE = [
		7,
		10,
		13,
		17,
		10,
		16,
		22,
		28,
		15,
		26,
		36,
		44,
		20,
		36,
		52,
		64,
		26,
		48,
		72,
		88,
		36,
		64,
		96,
		112,
		40,
		72,
		108,
		130,
		48,
		88,
		132,
		156,
		60,
		110,
		160,
		192,
		72,
		130,
		192,
		224,
		80,
		150,
		224,
		264,
		96,
		176,
		260,
		308,
		104,
		198,
		288,
		352,
		120,
		216,
		320,
		384,
		132,
		240,
		360,
		432,
		144,
		280,
		408,
		480,
		168,
		308,
		448,
		532,
		180,
		338,
		504,
		588,
		196,
		364,
		546,
		650,
		224,
		416,
		600,
		700,
		224,
		442,
		644,
		750,
		252,
		476,
		690,
		816,
		270,
		504,
		750,
		900,
		300,
		560,
		810,
		960,
		312,
		588,
		870,
		1050,
		336,
		644,
		952,
		1110,
		360,
		700,
		1020,
		1200,
		390,
		728,
		1050,
		1260,
		420,
		784,
		1140,
		1350,
		450,
		812,
		1200,
		1440,
		480,
		868,
		1290,
		1530,
		510,
		924,
		1350,
		1620,
		540,
		980,
		1440,
		1710,
		570,
		1036,
		1530,
		1800,
		570,
		1064,
		1590,
		1890,
		600,
		1120,
		1680,
		1980,
		630,
		1204,
		1770,
		2100,
		660,
		1260,
		1860,
		2220,
		720,
		1316,
		1950,
		2310,
		750,
		1372,
		2040,
		2430
	];
	/**
	* Returns the number of error correction block that the QR Code should contain
	* for the specified version and error correction level.
	*
	* @param  {Number} version              QR Code version
	* @param  {Number} errorCorrectionLevel Error correction level
	* @return {Number}                      Number of error correction blocks
	*/
	exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
		switch (errorCorrectionLevel) {
			case ECLevel.L: return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
			case ECLevel.M: return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
			case ECLevel.Q: return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
			case ECLevel.H: return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
			default: return;
		}
	};
	/**
	* Returns the number of error correction codewords to use for the specified
	* version and error correction level.
	*
	* @param  {Number} version              QR Code version
	* @param  {Number} errorCorrectionLevel Error correction level
	* @return {Number}                      Number of error correction codewords
	*/
	exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
		switch (errorCorrectionLevel) {
			case ECLevel.L: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
			case ECLevel.M: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
			case ECLevel.Q: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
			case ECLevel.H: return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
			default: return;
		}
	};
}));
// node_modules/qrcode/lib/core/galois-field.js
var require_galois_field = /* @__PURE__ */ __commonJSMin(((exports) => {
	const EXP_TABLE = /* @__PURE__ */ new Uint8Array(512);
	const LOG_TABLE = /* @__PURE__ */ new Uint8Array(256);
	(function initTables() {
		let x = 1;
		for (let i = 0; i < 255; i++) {
			EXP_TABLE[i] = x;
			LOG_TABLE[x] = i;
			x <<= 1;
			if (x & 256) x ^= 285;
		}
		for (let i = 255; i < 512; i++) EXP_TABLE[i] = EXP_TABLE[i - 255];
	})();
	/**
	* Returns log value of n inside Galois Field
	*
	* @param  {Number} n
	* @return {Number}
	*/
	exports.log = function log(n) {
		if (n < 1) throw new Error("log(" + n + ")");
		return LOG_TABLE[n];
	};
	/**
	* Returns anti-log value of n inside Galois Field
	*
	* @param  {Number} n
	* @return {Number}
	*/
	exports.exp = function exp(n) {
		return EXP_TABLE[n];
	};
	/**
	* Multiplies two number inside Galois Field
	*
	* @param  {Number} x
	* @param  {Number} y
	* @return {Number}
	*/
	exports.mul = function mul(x, y) {
		if (x === 0 || y === 0) return 0;
		return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
	};
}));
// node_modules/qrcode/lib/core/polynomial.js
var require_polynomial = /* @__PURE__ */ __commonJSMin(((exports) => {
	const GF = require_galois_field();
	/**
	* Multiplies two polynomials inside Galois Field
	*
	* @param  {Uint8Array} p1 Polynomial
	* @param  {Uint8Array} p2 Polynomial
	* @return {Uint8Array}    Product of p1 and p2
	*/
	exports.mul = function mul(p1, p2) {
		const coeff = new Uint8Array(p1.length + p2.length - 1);
		for (let i = 0; i < p1.length; i++) for (let j = 0; j < p2.length; j++) coeff[i + j] ^= GF.mul(p1[i], p2[j]);
		return coeff;
	};
	/**
	* Calculate the remainder of polynomials division
	*
	* @param  {Uint8Array} divident Polynomial
	* @param  {Uint8Array} divisor  Polynomial
	* @return {Uint8Array}          Remainder
	*/
	exports.mod = function mod(divident, divisor) {
		let result = new Uint8Array(divident);
		while (result.length - divisor.length >= 0) {
			const coeff = result[0];
			for (let i = 0; i < divisor.length; i++) result[i] ^= GF.mul(divisor[i], coeff);
			let offset = 0;
			while (offset < result.length && result[offset] === 0) offset++;
			result = result.slice(offset);
		}
		return result;
	};
	/**
	* Generate an irreducible generator polynomial of specified degree
	* (used by Reed-Solomon encoder)
	*
	* @param  {Number} degree Degree of the generator polynomial
	* @return {Uint8Array}    Buffer containing polynomial coefficients
	*/
	exports.generateECPolynomial = function generateECPolynomial(degree) {
		let poly = new Uint8Array([1]);
		for (let i = 0; i < degree; i++) poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
		return poly;
	};
}));
// node_modules/qrcode/lib/core/reed-solomon-encoder.js
var require_reed_solomon_encoder = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Polynomial = require_polynomial();
	function ReedSolomonEncoder(degree) {
		this.genPoly = void 0;
		this.degree = degree;
		if (this.degree) this.initialize(this.degree);
	}
	/**
	* Initialize the encoder.
	* The input param should correspond to the number of error correction codewords.
	*
	* @param  {Number} degree
	*/
	ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
		this.degree = degree;
		this.genPoly = Polynomial.generateECPolynomial(this.degree);
	};
	/**
	* Encodes a chunk of data
	*
	* @param  {Uint8Array} data Buffer containing input data
	* @return {Uint8Array}      Buffer containing encoded data
	*/
	ReedSolomonEncoder.prototype.encode = function encode(data) {
		if (!this.genPoly) throw new Error("Encoder not initialized");
		const paddedData = new Uint8Array(data.length + this.degree);
		paddedData.set(data);
		const remainder = Polynomial.mod(paddedData, this.genPoly);
		const start = this.degree - remainder.length;
		if (start > 0) {
			const buff = new Uint8Array(this.degree);
			buff.set(remainder, start);
			return buff;
		}
		return remainder;
	};
	module.exports = ReedSolomonEncoder;
}));
// node_modules/qrcode/lib/core/version-check.js
var require_version_check = /* @__PURE__ */ __commonJSMin(((exports) => {
	/**
	* Check if QR Code version is valid
	*
	* @param  {Number}  version QR Code version
	* @return {Boolean}         true if valid version, false otherwise
	*/
	exports.isValid = function isValid(version) {
		return !isNaN(version) && version >= 1 && version <= 40;
	};
}));
// node_modules/qrcode/lib/core/regex.js
var require_regex = /* @__PURE__ */ __commonJSMin(((exports) => {
	const numeric = "[0-9]+";
	const alphanumeric = "[A-Z $%*+\\-./:]+";
	let kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
	kanji = kanji.replace(/u/g, "\\u");
	const byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
	exports.KANJI = new RegExp(kanji, "g");
	exports.BYTE_KANJI = /* @__PURE__ */ new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
	exports.BYTE = new RegExp(byte, "g");
	exports.NUMERIC = new RegExp(numeric, "g");
	exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
	const TEST_KANJI = new RegExp("^" + kanji + "$");
	const TEST_NUMERIC = /* @__PURE__ */ new RegExp("^[0-9]+$");
	const TEST_ALPHANUMERIC = /* @__PURE__ */ new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
	exports.testKanji = function testKanji(str) {
		return TEST_KANJI.test(str);
	};
	exports.testNumeric = function testNumeric(str) {
		return TEST_NUMERIC.test(str);
	};
	exports.testAlphanumeric = function testAlphanumeric(str) {
		return TEST_ALPHANUMERIC.test(str);
	};
}));
// node_modules/qrcode/lib/core/mode.js
var require_mode = /* @__PURE__ */ __commonJSMin(((exports) => {
	const VersionCheck = require_version_check();
	const Regex = require_regex();
	/**
	* Numeric mode encodes data from the decimal digit set (0 - 9)
	* (byte values 30HEX to 39HEX).
	* Normally, 3 data characters are represented by 10 bits.
	*
	* @type {Object}
	*/
	exports.NUMERIC = {
		id: "Numeric",
		bit: 1,
		ccBits: [
			10,
			12,
			14
		]
	};
	/**
	* Alphanumeric mode encodes data from a set of 45 characters,
	* i.e. 10 numeric digits (0 - 9),
	*      26 alphabetic characters (A - Z),
	*   and 9 symbols (SP, $, %, *, +, -, ., /, :).
	* Normally, two input characters are represented by 11 bits.
	*
	* @type {Object}
	*/
	exports.ALPHANUMERIC = {
		id: "Alphanumeric",
		bit: 2,
		ccBits: [
			9,
			11,
			13
		]
	};
	/**
	* In byte mode, data is encoded at 8 bits per character.
	*
	* @type {Object}
	*/
	exports.BYTE = {
		id: "Byte",
		bit: 4,
		ccBits: [
			8,
			16,
			16
		]
	};
	/**
	* The Kanji mode efficiently encodes Kanji characters in accordance with
	* the Shift JIS system based on JIS X 0208.
	* The Shift JIS values are shifted from the JIS X 0208 values.
	* JIS X 0208 gives details of the shift coded representation.
	* Each two-byte character value is compacted to a 13-bit binary codeword.
	*
	* @type {Object}
	*/
	exports.KANJI = {
		id: "Kanji",
		bit: 8,
		ccBits: [
			8,
			10,
			12
		]
	};
	/**
	* Mixed mode will contain a sequences of data in a combination of any of
	* the modes described above
	*
	* @type {Object}
	*/
	exports.MIXED = { bit: -1 };
	/**
	* Returns the number of bits needed to store the data length
	* according to QR Code specifications.
	*
	* @param  {Mode}   mode    Data mode
	* @param  {Number} version QR Code version
	* @return {Number}         Number of bits
	*/
	exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
		if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
		if (!VersionCheck.isValid(version)) throw new Error("Invalid version: " + version);
		if (version >= 1 && version < 10) return mode.ccBits[0];
		else if (version < 27) return mode.ccBits[1];
		return mode.ccBits[2];
	};
	/**
	* Returns the most efficient mode to store the specified data
	*
	* @param  {String} dataStr Input data string
	* @return {Mode}           Best mode
	*/
	exports.getBestModeForData = function getBestModeForData(dataStr) {
		if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
		else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
		else if (Regex.testKanji(dataStr)) return exports.KANJI;
		else return exports.BYTE;
	};
	/**
	* Return mode name as string
	*
	* @param {Mode} mode Mode object
	* @returns {String}  Mode name
	*/
	exports.toString = function toString(mode) {
		if (mode && mode.id) return mode.id;
		throw new Error("Invalid mode");
	};
	/**
	* Check if input param is a valid mode object
	*
	* @param   {Mode}    mode Mode object
	* @returns {Boolean} True if valid mode, false otherwise
	*/
	exports.isValid = function isValid(mode) {
		return mode && mode.bit && mode.ccBits;
	};
	/**
	* Get mode object from its name
	*
	* @param   {String} string Mode name
	* @returns {Mode}          Mode object
	*/
	function fromString(string) {
		if (typeof string !== "string") throw new Error("Param is not a string");
		switch (string.toLowerCase()) {
			case "numeric": return exports.NUMERIC;
			case "alphanumeric": return exports.ALPHANUMERIC;
			case "kanji": return exports.KANJI;
			case "byte": return exports.BYTE;
			default: throw new Error("Unknown mode: " + string);
		}
	}
	/**
	* Returns mode from a value.
	* If value is not a valid mode, returns defaultValue
	*
	* @param  {Mode|String} value        Encoding mode
	* @param  {Mode}        defaultValue Fallback value
	* @return {Mode}                     Encoding mode
	*/
	exports.from = function from(value, defaultValue) {
		if (exports.isValid(value)) return value;
		try {
			return fromString(value);
		} catch (e) {
			return defaultValue;
		}
	};
}));
// node_modules/qrcode/lib/core/version.js
var require_version = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const ECCode = require_error_correction_code();
	const ECLevel = require_error_correction_level();
	const Mode = require_mode();
	const VersionCheck = require_version_check();
	const G18 = 7973;
	const G18_BCH = Utils.getBCHDigit(G18);
	function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
		for (let currentVersion = 1; currentVersion <= 40; currentVersion++) if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) return currentVersion;
	}
	function getReservedBitsCount(mode, version) {
		return Mode.getCharCountIndicator(mode, version) + 4;
	}
	function getTotalBitsFromDataArray(segments, version) {
		let totalBits = 0;
		segments.forEach(function(data) {
			const reservedBits = getReservedBitsCount(data.mode, version);
			totalBits += reservedBits + data.getBitsLength();
		});
		return totalBits;
	}
	function getBestVersionForMixedData(segments, errorCorrectionLevel) {
		for (let currentVersion = 1; currentVersion <= 40; currentVersion++) if (getTotalBitsFromDataArray(segments, currentVersion) <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) return currentVersion;
	}
	/**
	* Returns version number from a value.
	* If value is not a valid version, returns defaultValue
	*
	* @param  {Number|String} value        QR Code version
	* @param  {Number}        defaultValue Fallback value
	* @return {Number}                     QR Code version number
	*/
	exports.from = function from(value, defaultValue) {
		if (VersionCheck.isValid(value)) return parseInt(value, 10);
		return defaultValue;
	};
	/**
	* Returns how much data can be stored with the specified QR code version
	* and error correction level
	*
	* @param  {Number} version              QR Code version (1-40)
	* @param  {Number} errorCorrectionLevel Error correction level
	* @param  {Mode}   mode                 Data mode
	* @return {Number}                      Quantity of storable data
	*/
	exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
		if (!VersionCheck.isValid(version)) throw new Error("Invalid QR Code version");
		if (typeof mode === "undefined") mode = Mode.BYTE;
		const dataTotalCodewordsBits = (Utils.getSymbolTotalCodewords(version) - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel)) * 8;
		if (mode === Mode.MIXED) return dataTotalCodewordsBits;
		const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
		switch (mode) {
			case Mode.NUMERIC: return Math.floor(usableBits / 10 * 3);
			case Mode.ALPHANUMERIC: return Math.floor(usableBits / 11 * 2);
			case Mode.KANJI: return Math.floor(usableBits / 13);
			case Mode.BYTE:
			default: return Math.floor(usableBits / 8);
		}
	};
	/**
	* Returns the minimum version needed to contain the amount of data
	*
	* @param  {Segment} data                    Segment of data
	* @param  {Number} [errorCorrectionLevel=H] Error correction level
	* @param  {Mode} mode                       Data mode
	* @return {Number}                          QR Code version
	*/
	exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
		let seg;
		const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
		if (Array.isArray(data)) {
			if (data.length > 1) return getBestVersionForMixedData(data, ecl);
			if (data.length === 0) return 1;
			seg = data[0];
		} else seg = data;
		return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
	};
	/**
	* Returns version information with relative error correction bits
	*
	* The version information is included in QR Code symbols of version 7 or larger.
	* It consists of an 18-bit sequence containing 6 data bits,
	* with 12 error correction bits calculated using the (18, 6) Golay code.
	*
	* @param  {Number} version QR Code version
	* @return {Number}         Encoded version info bits
	*/
	exports.getEncodedBits = function getEncodedBits(version) {
		if (!VersionCheck.isValid(version) || version < 7) throw new Error("Invalid QR Code version");
		let d = version << 12;
		while (Utils.getBCHDigit(d) - G18_BCH >= 0) d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
		return version << 12 | d;
	};
}));
// node_modules/qrcode/lib/core/format-info.js
var require_format_info = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const G15 = 1335;
	const G15_MASK = 21522;
	const G15_BCH = Utils.getBCHDigit(G15);
	/**
	* Returns format information with relative error correction bits
	*
	* The format information is a 15-bit sequence containing 5 data bits,
	* with 10 error correction bits calculated using the (15, 5) BCH code.
	*
	* @param  {Number} errorCorrectionLevel Error correction level
	* @param  {Number} mask                 Mask pattern
	* @return {Number}                      Encoded format information bits
	*/
	exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
		const data = errorCorrectionLevel.bit << 3 | mask;
		let d = data << 10;
		while (Utils.getBCHDigit(d) - G15_BCH >= 0) d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
		return (data << 10 | d) ^ G15_MASK;
	};
}));
// node_modules/qrcode/lib/core/numeric-data.js
var require_numeric_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	function NumericData(data) {
		this.mode = Mode.NUMERIC;
		this.data = data.toString();
	}
	NumericData.getBitsLength = function getBitsLength(length) {
		return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
	};
	NumericData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	NumericData.prototype.getBitsLength = function getBitsLength() {
		return NumericData.getBitsLength(this.data.length);
	};
	NumericData.prototype.write = function write(bitBuffer) {
		let i, group, value;
		for (i = 0; i + 3 <= this.data.length; i += 3) {
			group = this.data.substr(i, 3);
			value = parseInt(group, 10);
			bitBuffer.put(value, 10);
		}
		const remainingNum = this.data.length - i;
		if (remainingNum > 0) {
			group = this.data.substr(i);
			value = parseInt(group, 10);
			bitBuffer.put(value, remainingNum * 3 + 1);
		}
	};
	module.exports = NumericData;
}));
// node_modules/qrcode/lib/core/alphanumeric-data.js
var require_alphanumeric_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	/**
	* Array of characters available in alphanumeric mode
	*
	* As per QR Code specification, to each character
	* is assigned a value from 0 to 44 which in this case coincides
	* with the array index
	*
	* @type {Array}
	*/
	const ALPHA_NUM_CHARS = [
		"0",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
		"T",
		"U",
		"V",
		"W",
		"X",
		"Y",
		"Z",
		" ",
		"$",
		"%",
		"*",
		"+",
		"-",
		".",
		"/",
		":"
	];
	function AlphanumericData(data) {
		this.mode = Mode.ALPHANUMERIC;
		this.data = data;
	}
	AlphanumericData.getBitsLength = function getBitsLength(length) {
		return 11 * Math.floor(length / 2) + 6 * (length % 2);
	};
	AlphanumericData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	AlphanumericData.prototype.getBitsLength = function getBitsLength() {
		return AlphanumericData.getBitsLength(this.data.length);
	};
	AlphanumericData.prototype.write = function write(bitBuffer) {
		let i = 0;
		for (; i + 2 <= this.data.length; i += 2) {
			let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
			value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
			bitBuffer.put(value, 11);
		}
		if (this.data.length % 2) bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
	};
	module.exports = AlphanumericData;
}));
// node_modules/qrcode/lib/core/byte-data.js
var require_byte_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	function ByteData(data) {
		this.mode = Mode.BYTE;
		if (typeof data === "string") this.data = new TextEncoder().encode(data);
		else this.data = new Uint8Array(data);
	}
	ByteData.getBitsLength = function getBitsLength(length) {
		return length * 8;
	};
	ByteData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	ByteData.prototype.getBitsLength = function getBitsLength() {
		return ByteData.getBitsLength(this.data.length);
	};
	ByteData.prototype.write = function(bitBuffer) {
		for (let i = 0, l = this.data.length; i < l; i++) bitBuffer.put(this.data[i], 8);
	};
	module.exports = ByteData;
}));
// node_modules/qrcode/lib/core/kanji-data.js
var require_kanji_data = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const Mode = require_mode();
	const Utils = require_utils$1();
	function KanjiData(data) {
		this.mode = Mode.KANJI;
		this.data = data;
	}
	KanjiData.getBitsLength = function getBitsLength(length) {
		return length * 13;
	};
	KanjiData.prototype.getLength = function getLength() {
		return this.data.length;
	};
	KanjiData.prototype.getBitsLength = function getBitsLength() {
		return KanjiData.getBitsLength(this.data.length);
	};
	KanjiData.prototype.write = function(bitBuffer) {
		let i = 0;
		for (; i < this.data.length; i++) {
			let value = Utils.toSJIS(this.data[i]);
			if (value >= 33088 && value <= 40956) value -= 33088;
			else if (value >= 57408 && value <= 60351) value -= 49472;
			else throw new Error("Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8");
			value = (value >>> 8 & 255) * 192 + (value & 255);
			bitBuffer.put(value, 13);
		}
	};
	module.exports = KanjiData;
}));
// node_modules/dijkstrajs/dijkstra.js
var require_dijkstra = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/******************************************************************************
	* Created 2008-08-19.
	*
	* Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
	*
	* Copyright (C) 2008
	*   Wyatt Baldwin <self@wyattbaldwin.com>
	*   All rights reserved
	*
	* Licensed under the MIT license.
	*
	*   http://www.opensource.org/licenses/mit-license.php
	*
	* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	* THE SOFTWARE.
	*****************************************************************************/
	var dijkstra = {
		single_source_shortest_paths: function(graph, s, d) {
			var predecessors = {};
			var costs = {};
			costs[s] = 0;
			var open = dijkstra.PriorityQueue.make();
			open.push(s, 0);
			var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
			while (!open.empty()) {
				closest = open.pop();
				u = closest.value;
				cost_of_s_to_u = closest.cost;
				adjacent_nodes = graph[u] || {};
				for (v in adjacent_nodes) if (adjacent_nodes.hasOwnProperty(v)) {
					cost_of_e = adjacent_nodes[v];
					cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
					cost_of_s_to_v = costs[v];
					first_visit = typeof costs[v] === "undefined";
					if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
						costs[v] = cost_of_s_to_u_plus_cost_of_e;
						open.push(v, cost_of_s_to_u_plus_cost_of_e);
						predecessors[v] = u;
					}
				}
			}
			if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
				var msg = [
					"Could not find a path from ",
					s,
					" to ",
					d,
					"."
				].join("");
				throw new Error(msg);
			}
			return predecessors;
		},
		extract_shortest_path_from_predecessor_list: function(predecessors, d) {
			var nodes = [];
			var u = d;
			while (u) {
				nodes.push(u);
				predecessors[u];
				u = predecessors[u];
			}
			nodes.reverse();
			return nodes;
		},
		find_path: function(graph, s, d) {
			var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
			return dijkstra.extract_shortest_path_from_predecessor_list(predecessors, d);
		},
		/**
		* A very naive priority queue implementation.
		*/
		PriorityQueue: {
			make: function(opts) {
				var T = dijkstra.PriorityQueue, t = {}, key;
				opts = opts || {};
				for (key in T) if (T.hasOwnProperty(key)) t[key] = T[key];
				t.queue = [];
				t.sorter = opts.sorter || T.default_sorter;
				return t;
			},
			default_sorter: function(a, b) {
				return a.cost - b.cost;
			},
			/**
			* Add a new item to the queue and ensure the highest priority element
			* is at the front of the queue.
			*/
			push: function(value, cost) {
				var item = {
					value,
					cost
				};
				this.queue.push(item);
				this.queue.sort(this.sorter);
			},
			/**
			* Return the highest priority element in the queue.
			*/
			pop: function() {
				return this.queue.shift();
			},
			empty: function() {
				return this.queue.length === 0;
			}
		}
	};
	if (typeof module !== "undefined") module.exports = dijkstra;
}));
// node_modules/qrcode/lib/core/segments.js
var require_segments = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Mode = require_mode();
	const NumericData = require_numeric_data();
	const AlphanumericData = require_alphanumeric_data();
	const ByteData = require_byte_data();
	const KanjiData = require_kanji_data();
	const Regex = require_regex();
	const Utils = require_utils$1();
	const dijkstra = require_dijkstra();
	/**
	* Returns UTF8 byte length
	*
	* @param  {String} str Input string
	* @return {Number}     Number of byte
	*/
	function getStringByteLength(str) {
		return unescape(encodeURIComponent(str)).length;
	}
	/**
	* Get a list of segments of the specified mode
	* from a string
	*
	* @param  {Mode}   mode Segment mode
	* @param  {String} str  String to process
	* @return {Array}       Array of object with segments data
	*/
	function getSegments(regex, mode, str) {
		const segments = [];
		let result;
		while ((result = regex.exec(str)) !== null) segments.push({
			data: result[0],
			index: result.index,
			mode,
			length: result[0].length
		});
		return segments;
	}
	/**
	* Extracts a series of segments with the appropriate
	* modes from a string
	*
	* @param  {String} dataStr Input string
	* @return {Array}          Array of object with segments data
	*/
	function getSegmentsFromString(dataStr) {
		const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
		const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
		let byteSegs;
		let kanjiSegs;
		if (Utils.isKanjiModeEnabled()) {
			byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
			kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
		} else {
			byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
			kanjiSegs = [];
		}
		return numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs).sort(function(s1, s2) {
			return s1.index - s2.index;
		}).map(function(obj) {
			return {
				data: obj.data,
				mode: obj.mode,
				length: obj.length
			};
		});
	}
	/**
	* Returns how many bits are needed to encode a string of
	* specified length with the specified mode
	*
	* @param  {Number} length String length
	* @param  {Mode} mode     Segment mode
	* @return {Number}        Bit length
	*/
	function getSegmentBitsLength(length, mode) {
		switch (mode) {
			case Mode.NUMERIC: return NumericData.getBitsLength(length);
			case Mode.ALPHANUMERIC: return AlphanumericData.getBitsLength(length);
			case Mode.KANJI: return KanjiData.getBitsLength(length);
			case Mode.BYTE: return ByteData.getBitsLength(length);
		}
	}
	/**
	* Merges adjacent segments which have the same mode
	*
	* @param  {Array} segs Array of object with segments data
	* @return {Array}      Array of object with segments data
	*/
	function mergeSegments(segs) {
		return segs.reduce(function(acc, curr) {
			const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
			if (prevSeg && prevSeg.mode === curr.mode) {
				acc[acc.length - 1].data += curr.data;
				return acc;
			}
			acc.push(curr);
			return acc;
		}, []);
	}
	/**
	* Generates a list of all possible nodes combination which
	* will be used to build a segments graph.
	*
	* Nodes are divided by groups. Each group will contain a list of all the modes
	* in which is possible to encode the given text.
	*
	* For example the text '12345' can be encoded as Numeric, Alphanumeric or Byte.
	* The group for '12345' will contain then 3 objects, one for each
	* possible encoding mode.
	*
	* Each node represents a possible segment.
	*
	* @param  {Array} segs Array of object with segments data
	* @return {Array}      Array of object with segments data
	*/
	function buildNodes(segs) {
		const nodes = [];
		for (let i = 0; i < segs.length; i++) {
			const seg = segs[i];
			switch (seg.mode) {
				case Mode.NUMERIC:
					nodes.push([
						seg,
						{
							data: seg.data,
							mode: Mode.ALPHANUMERIC,
							length: seg.length
						},
						{
							data: seg.data,
							mode: Mode.BYTE,
							length: seg.length
						}
					]);
					break;
				case Mode.ALPHANUMERIC:
					nodes.push([seg, {
						data: seg.data,
						mode: Mode.BYTE,
						length: seg.length
					}]);
					break;
				case Mode.KANJI:
					nodes.push([seg, {
						data: seg.data,
						mode: Mode.BYTE,
						length: getStringByteLength(seg.data)
					}]);
					break;
				case Mode.BYTE: nodes.push([{
					data: seg.data,
					mode: Mode.BYTE,
					length: getStringByteLength(seg.data)
				}]);
			}
		}
		return nodes;
	}
	/**
	* Builds a graph from a list of nodes.
	* All segments in each node group will be connected with all the segments of
	* the next group and so on.
	*
	* At each connection will be assigned a weight depending on the
	* segment's byte length.
	*
	* @param  {Array} nodes    Array of object with segments data
	* @param  {Number} version QR Code version
	* @return {Object}         Graph of all possible segments
	*/
	function buildGraph(nodes, version) {
		const table = {};
		const graph = { start: {} };
		let prevNodeIds = ["start"];
		for (let i = 0; i < nodes.length; i++) {
			const nodeGroup = nodes[i];
			const currentNodeIds = [];
			for (let j = 0; j < nodeGroup.length; j++) {
				const node = nodeGroup[j];
				const key = "" + i + j;
				currentNodeIds.push(key);
				table[key] = {
					node,
					lastCount: 0
				};
				graph[key] = {};
				for (let n = 0; n < prevNodeIds.length; n++) {
					const prevNodeId = prevNodeIds[n];
					if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
						graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
						table[prevNodeId].lastCount += node.length;
					} else {
						if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
						graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
					}
				}
			}
			prevNodeIds = currentNodeIds;
		}
		for (let n = 0; n < prevNodeIds.length; n++) graph[prevNodeIds[n]].end = 0;
		return {
			map: graph,
			table
		};
	}
	/**
	* Builds a segment from a specified data and mode.
	* If a mode is not specified, the more suitable will be used.
	*
	* @param  {String} data             Input data
	* @param  {Mode | String} modesHint Data mode
	* @return {Segment}                 Segment
	*/
	function buildSingleSegment(data, modesHint) {
		let mode;
		const bestMode = Mode.getBestModeForData(data);
		mode = Mode.from(modesHint, bestMode);
		if (mode !== Mode.BYTE && mode.bit < bestMode.bit) throw new Error("\"" + data + "\" cannot be encoded with mode " + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
		if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) mode = Mode.BYTE;
		switch (mode) {
			case Mode.NUMERIC: return new NumericData(data);
			case Mode.ALPHANUMERIC: return new AlphanumericData(data);
			case Mode.KANJI: return new KanjiData(data);
			case Mode.BYTE: return new ByteData(data);
		}
	}
	/**
	* Builds a list of segments from an array.
	* Array can contain Strings or Objects with segment's info.
	*
	* For each item which is a string, will be generated a segment with the given
	* string and the more appropriate encoding mode.
	*
	* For each item which is an object, will be generated a segment with the given
	* data and mode.
	* Objects must contain at least the property "data".
	* If property "mode" is not present, the more suitable mode will be used.
	*
	* @param  {Array} array Array of objects with segments data
	* @return {Array}       Array of Segments
	*/
	exports.fromArray = function fromArray(array) {
		return array.reduce(function(acc, seg) {
			if (typeof seg === "string") acc.push(buildSingleSegment(seg, null));
			else if (seg.data) acc.push(buildSingleSegment(seg.data, seg.mode));
			return acc;
		}, []);
	};
	/**
	* Builds an optimized sequence of segments from a string,
	* which will produce the shortest possible bitstream.
	*
	* @param  {String} data    Input string
	* @param  {Number} version QR Code version
	* @return {Array}          Array of segments
	*/
	exports.fromString = function fromString(data, version) {
		const graph = buildGraph(buildNodes(getSegmentsFromString(data, Utils.isKanjiModeEnabled())), version);
		const path = dijkstra.find_path(graph.map, "start", "end");
		const optimizedSegs = [];
		for (let i = 1; i < path.length - 1; i++) optimizedSegs.push(graph.table[path[i]].node);
		return exports.fromArray(mergeSegments(optimizedSegs));
	};
	/**
	* Splits a string in various segments with the modes which
	* best represent their content.
	* The produced segments are far from being optimized.
	* The output of this function is only used to estimate a QR Code version
	* which may contain the data.
	*
	* @param  {string} data Input string
	* @return {Array}       Array of segments
	*/
	exports.rawSplit = function rawSplit(data) {
		return exports.fromArray(getSegmentsFromString(data, Utils.isKanjiModeEnabled()));
	};
}));
// node_modules/qrcode/lib/core/qrcode.js
var require_qrcode = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils$1();
	const ECLevel = require_error_correction_level();
	const BitBuffer = require_bit_buffer();
	const BitMatrix = require_bit_matrix();
	const AlignmentPattern = require_alignment_pattern();
	const FinderPattern = require_finder_pattern();
	const MaskPattern = require_mask_pattern();
	const ECCode = require_error_correction_code();
	const ReedSolomonEncoder = require_reed_solomon_encoder();
	const Version = require_version();
	const FormatInfo = require_format_info();
	const Mode = require_mode();
	const Segments = require_segments();
	/**
	* QRCode for JavaScript
	*
	* modified by Ryan Day for nodejs support
	* Copyright (c) 2011 Ryan Day
	*
	* Licensed under the MIT license:
	*   http://www.opensource.org/licenses/mit-license.php
	*
	//---------------------------------------------------------------------
	// QRCode for JavaScript
	//
	// Copyright (c) 2009 Kazuhiko Arase
	//
	// URL: http://www.d-project.com/
	//
	// Licensed under the MIT license:
	//   http://www.opensource.org/licenses/mit-license.php
	//
	// The word "QR Code" is registered trademark of
	// DENSO WAVE INCORPORATED
	//   http://www.denso-wave.com/qrcode/faqpatent-e.html
	//
	//---------------------------------------------------------------------
	*/
	/**
	* Add finder patterns bits to matrix
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupFinderPattern(matrix, version) {
		const size = matrix.size;
		const pos = FinderPattern.getPositions(version);
		for (let i = 0; i < pos.length; i++) {
			const row = pos[i][0];
			const col = pos[i][1];
			for (let r = -1; r <= 7; r++) {
				if (row + r <= -1 || size <= row + r) continue;
				for (let c = -1; c <= 7; c++) {
					if (col + c <= -1 || size <= col + c) continue;
					if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) matrix.set(row + r, col + c, true, true);
					else matrix.set(row + r, col + c, false, true);
				}
			}
		}
	}
	/**
	* Add timing pattern bits to matrix
	*
	* Note: this function must be called before {@link setupAlignmentPattern}
	*
	* @param  {BitMatrix} matrix Modules matrix
	*/
	function setupTimingPattern(matrix) {
		const size = matrix.size;
		for (let r = 8; r < size - 8; r++) {
			const value = r % 2 === 0;
			matrix.set(r, 6, value, true);
			matrix.set(6, r, value, true);
		}
	}
	/**
	* Add alignment patterns bits to matrix
	*
	* Note: this function must be called after {@link setupTimingPattern}
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupAlignmentPattern(matrix, version) {
		const pos = AlignmentPattern.getPositions(version);
		for (let i = 0; i < pos.length; i++) {
			const row = pos[i][0];
			const col = pos[i][1];
			for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) matrix.set(row + r, col + c, true, true);
			else matrix.set(row + r, col + c, false, true);
		}
	}
	/**
	* Add version info bits to matrix
	*
	* @param  {BitMatrix} matrix  Modules matrix
	* @param  {Number}    version QR Code version
	*/
	function setupVersionInfo(matrix, version) {
		const size = matrix.size;
		const bits = Version.getEncodedBits(version);
		let row, col, mod;
		for (let i = 0; i < 18; i++) {
			row = Math.floor(i / 3);
			col = i % 3 + size - 8 - 3;
			mod = (bits >> i & 1) === 1;
			matrix.set(row, col, mod, true);
			matrix.set(col, row, mod, true);
		}
	}
	/**
	* Add format info bits to matrix
	*
	* @param  {BitMatrix} matrix               Modules matrix
	* @param  {ErrorCorrectionLevel}    errorCorrectionLevel Error correction level
	* @param  {Number}    maskPattern          Mask pattern reference value
	*/
	function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
		const size = matrix.size;
		const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
		let i, mod;
		for (i = 0; i < 15; i++) {
			mod = (bits >> i & 1) === 1;
			if (i < 6) matrix.set(i, 8, mod, true);
			else if (i < 8) matrix.set(i + 1, 8, mod, true);
			else matrix.set(size - 15 + i, 8, mod, true);
			if (i < 8) matrix.set(8, size - i - 1, mod, true);
			else if (i < 9) matrix.set(8, 15 - i - 1 + 1, mod, true);
			else matrix.set(8, 15 - i - 1, mod, true);
		}
		matrix.set(size - 8, 8, 1, true);
	}
	/**
	* Add encoded data bits to matrix
	*
	* @param  {BitMatrix}  matrix Modules matrix
	* @param  {Uint8Array} data   Data codewords
	*/
	function setupData(matrix, data) {
		const size = matrix.size;
		let inc = -1;
		let row = size - 1;
		let bitIndex = 7;
		let byteIndex = 0;
		for (let col = size - 1; col > 0; col -= 2) {
			if (col === 6) col--;
			while (true) {
				for (let c = 0; c < 2; c++) if (!matrix.isReserved(row, col - c)) {
					let dark = false;
					if (byteIndex < data.length) dark = (data[byteIndex] >>> bitIndex & 1) === 1;
					matrix.set(row, col - c, dark);
					bitIndex--;
					if (bitIndex === -1) {
						byteIndex++;
						bitIndex = 7;
					}
				}
				row += inc;
				if (row < 0 || size <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
	}
	/**
	* Create encoded codewords from data input
	*
	* @param  {Number}   version              QR Code version
	* @param  {ErrorCorrectionLevel}   errorCorrectionLevel Error correction level
	* @param  {ByteData} data                 Data input
	* @return {Uint8Array}                    Buffer containing encoded codewords
	*/
	function createData(version, errorCorrectionLevel, segments) {
		const buffer = new BitBuffer();
		segments.forEach(function(data) {
			buffer.put(data.mode.bit, 4);
			buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
			data.write(buffer);
		});
		const dataTotalCodewordsBits = (Utils.getSymbolTotalCodewords(version) - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel)) * 8;
		if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) buffer.put(0, 4);
		while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(0);
		const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
		for (let i = 0; i < remainingByte; i++) buffer.put(i % 2 ? 17 : 236, 8);
		return createCodewords(buffer, version, errorCorrectionLevel);
	}
	/**
	* Encode input data with Reed-Solomon and return codewords with
	* relative error correction bits
	*
	* @param  {BitBuffer} bitBuffer            Data to encode
	* @param  {Number}    version              QR Code version
	* @param  {ErrorCorrectionLevel} errorCorrectionLevel Error correction level
	* @return {Uint8Array}                     Buffer containing encoded codewords
	*/
	function createCodewords(bitBuffer, version, errorCorrectionLevel) {
		const totalCodewords = Utils.getSymbolTotalCodewords(version);
		const dataTotalCodewords = totalCodewords - ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
		const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
		const blocksInGroup1 = ecTotalBlocks - totalCodewords % ecTotalBlocks;
		const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
		const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
		const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
		const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
		const rs = new ReedSolomonEncoder(ecCount);
		let offset = 0;
		const dcData = new Array(ecTotalBlocks);
		const ecData = new Array(ecTotalBlocks);
		let maxDataSize = 0;
		const buffer = new Uint8Array(bitBuffer.buffer);
		for (let b = 0; b < ecTotalBlocks; b++) {
			const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
			dcData[b] = buffer.slice(offset, offset + dataSize);
			ecData[b] = rs.encode(dcData[b]);
			offset += dataSize;
			maxDataSize = Math.max(maxDataSize, dataSize);
		}
		const data = new Uint8Array(totalCodewords);
		let index = 0;
		let i, r;
		for (i = 0; i < maxDataSize; i++) for (r = 0; r < ecTotalBlocks; r++) if (i < dcData[r].length) data[index++] = dcData[r][i];
		for (i = 0; i < ecCount; i++) for (r = 0; r < ecTotalBlocks; r++) data[index++] = ecData[r][i];
		return data;
	}
	/**
	* Build QR Code symbol
	*
	* @param  {String} data                 Input string
	* @param  {Number} version              QR Code version
	* @param  {ErrorCorretionLevel} errorCorrectionLevel Error level
	* @param  {MaskPattern} maskPattern     Mask pattern
	* @return {Object}                      Object containing symbol data
	*/
	function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
		let segments;
		if (Array.isArray(data)) segments = Segments.fromArray(data);
		else if (typeof data === "string") {
			let estimatedVersion = version;
			if (!estimatedVersion) {
				const rawSegments = Segments.rawSplit(data);
				estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
			}
			segments = Segments.fromString(data, estimatedVersion || 40);
		} else throw new Error("Invalid data");
		const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
		if (!bestVersion) throw new Error("The amount of data is too big to be stored in a QR Code");
		if (!version) version = bestVersion;
		else if (version < bestVersion) throw new Error("\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n");
		const dataBits = createData(version, errorCorrectionLevel, segments);
		const moduleCount = Utils.getSymbolSize(version);
		const modules = new BitMatrix(moduleCount);
		setupFinderPattern(modules, version);
		setupTimingPattern(modules);
		setupAlignmentPattern(modules, version);
		setupFormatInfo(modules, errorCorrectionLevel, 0);
		if (version >= 7) setupVersionInfo(modules, version);
		setupData(modules, dataBits);
		if (isNaN(maskPattern)) maskPattern = MaskPattern.getBestMask(modules, setupFormatInfo.bind(null, modules, errorCorrectionLevel));
		MaskPattern.applyMask(maskPattern, modules);
		setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
		return {
			modules,
			version,
			errorCorrectionLevel,
			maskPattern,
			segments
		};
	}
	/**
	* QR Code
	*
	* @param {String | Array} data                 Input data
	* @param {Object} options                      Optional configurations
	* @param {Number} options.version              QR Code version
	* @param {String} options.errorCorrectionLevel Error correction level
	* @param {Function} options.toSJISFunc         Helper func to convert utf8 to sjis
	*/
	exports.create = function create(data, options) {
		if (typeof data === "undefined" || data === "") throw new Error("No input text");
		let errorCorrectionLevel = ECLevel.M;
		let version;
		let mask;
		if (typeof options !== "undefined") {
			errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
			version = Version.from(options.version);
			mask = MaskPattern.from(options.maskPattern);
			if (options.toSJISFunc) Utils.setToSJISFunction(options.toSJISFunc);
		}
		return createSymbol(data, version, errorCorrectionLevel, mask);
	};
}));
// node_modules/qrcode/lib/renderer/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
	function hex2rgba(hex) {
		if (typeof hex === "number") hex = hex.toString();
		if (typeof hex !== "string") throw new Error("Color should be defined as hex string");
		let hexCode = hex.slice().replace("#", "").split("");
		if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) throw new Error("Invalid hex color: " + hex);
		if (hexCode.length === 3 || hexCode.length === 4) hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
			return [c, c];
		}));
		if (hexCode.length === 6) hexCode.push("F", "F");
		const hexValue = parseInt(hexCode.join(""), 16);
		return {
			r: hexValue >> 24 & 255,
			g: hexValue >> 16 & 255,
			b: hexValue >> 8 & 255,
			a: hexValue & 255,
			hex: "#" + hexCode.slice(0, 6).join("")
		};
	}
	exports.getOptions = function getOptions(options) {
		if (!options) options = {};
		if (!options.color) options.color = {};
		const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
		const width = options.width && options.width >= 21 ? options.width : void 0;
		const scale = options.scale || 4;
		return {
			width,
			scale: width ? 4 : scale,
			margin,
			color: {
				dark: hex2rgba(options.color.dark || "#000000ff"),
				light: hex2rgba(options.color.light || "#ffffffff")
			},
			type: options.type,
			rendererOpts: options.rendererOpts || {}
		};
	};
	exports.getScale = function getScale(qrSize, opts) {
		return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
	};
	exports.getImageWidth = function getImageWidth(qrSize, opts) {
		const scale = exports.getScale(qrSize, opts);
		return Math.floor((qrSize + opts.margin * 2) * scale);
	};
	exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
		const size = qr.modules.size;
		const data = qr.modules.data;
		const scale = exports.getScale(size, opts);
		const symbolSize = Math.floor((size + opts.margin * 2) * scale);
		const scaledMargin = opts.margin * scale;
		const palette = [opts.color.light, opts.color.dark];
		for (let i = 0; i < symbolSize; i++) for (let j = 0; j < symbolSize; j++) {
			let posDst = (i * symbolSize + j) * 4;
			let pxColor = opts.color.light;
			if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
				const iSrc = Math.floor((i - scaledMargin) / scale);
				const jSrc = Math.floor((j - scaledMargin) / scale);
				pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
			}
			imgData[posDst++] = pxColor.r;
			imgData[posDst++] = pxColor.g;
			imgData[posDst++] = pxColor.b;
			imgData[posDst] = pxColor.a;
		}
	};
}));
// node_modules/qrcode/lib/renderer/canvas.js
var require_canvas = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils();
	function clearCanvas(ctx, canvas, size) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!canvas.style) canvas.style = {};
		canvas.height = size;
		canvas.width = size;
		canvas.style.height = size + "px";
		canvas.style.width = size + "px";
	}
	function getCanvasElement() {
		try {
			return document.createElement("canvas");
		} catch (e) {
			throw new Error("You need to specify a canvas element");
		}
	}
	exports.render = function render(qrData, canvas, options) {
		let opts = options;
		let canvasEl = canvas;
		if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
			opts = canvas;
			canvas = void 0;
		}
		if (!canvas) canvasEl = getCanvasElement();
		opts = Utils.getOptions(opts);
		const size = Utils.getImageWidth(qrData.modules.size, opts);
		const ctx = canvasEl.getContext("2d");
		const image = ctx.createImageData(size, size);
		Utils.qrToImageData(image.data, qrData, opts);
		clearCanvas(ctx, canvasEl, size);
		ctx.putImageData(image, 0, 0);
		return canvasEl;
	};
	exports.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
		let opts = options;
		if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
			opts = canvas;
			canvas = void 0;
		}
		if (!opts) opts = {};
		const canvasEl = exports.render(qrData, canvas, opts);
		const type = opts.type || "image/png";
		const rendererOpts = opts.rendererOpts || {};
		return canvasEl.toDataURL(type, rendererOpts.quality);
	};
}));
// node_modules/qrcode/lib/renderer/svg-tag.js
var require_svg_tag = /* @__PURE__ */ __commonJSMin(((exports) => {
	const Utils = require_utils();
	function getColorAttrib(color, attrib) {
		const alpha = color.a / 255;
		const str = attrib + "=\"" + color.hex + "\"";
		return alpha < 1 ? str + " " + attrib + "-opacity=\"" + alpha.toFixed(2).slice(1) + "\"" : str;
	}
	function svgCmd(cmd, x, y) {
		let str = cmd + x;
		if (typeof y !== "undefined") str += " " + y;
		return str;
	}
	function qrToPath(data, size, margin) {
		let path = "";
		let moveBy = 0;
		let newRow = false;
		let lineLength = 0;
		for (let i = 0; i < data.length; i++) {
			const col = Math.floor(i % size);
			const row = Math.floor(i / size);
			if (!col && !newRow) newRow = true;
			if (data[i]) {
				lineLength++;
				if (!(i > 0 && col > 0 && data[i - 1])) {
					path += newRow ? svgCmd("M", col + margin, .5 + row + margin) : svgCmd("m", moveBy, 0);
					moveBy = 0;
					newRow = false;
				}
				if (!(col + 1 < size && data[i + 1])) {
					path += svgCmd("h", lineLength);
					lineLength = 0;
				}
			} else moveBy++;
		}
		return path;
	}
	exports.render = function render(qrData, options, cb) {
		const opts = Utils.getOptions(options);
		const size = qrData.modules.size;
		const data = qrData.modules.data;
		const qrcodesize = size + opts.margin * 2;
		const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + " d=\"M0 0h" + qrcodesize + "v" + qrcodesize + "H0z\"/>";
		const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + " d=\"" + qrToPath(data, size, opts.margin) + "\"/>";
		const viewBox = "viewBox=\"0 0 " + qrcodesize + " " + qrcodesize + "\"";
		const svgTag = "<svg xmlns=\"http://www.w3.org/2000/svg\" " + (!opts.width ? "" : "width=\"" + opts.width + "\" height=\"" + opts.width + "\" ") + viewBox + " shape-rendering=\"crispEdges\">" + bg + path + "</svg>\n";
		if (typeof cb === "function") cb(null, svgTag);
		return svgTag;
	};
}));
// src/client/icons.tsx
var import_browser = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports) => {
	const canPromise = require_can_promise();
	const QRCode = require_qrcode();
	const CanvasRenderer = require_canvas();
	const SvgRenderer = require_svg_tag();
	function renderCanvas(renderFunc, canvas, text, opts, cb) {
		const args = [].slice.call(arguments, 1);
		const argsNum = args.length;
		const isLastArgCb = typeof args[argsNum - 1] === "function";
		if (!isLastArgCb && !canPromise()) throw new Error("Callback required as last argument");
		if (isLastArgCb) {
			if (argsNum < 2) throw new Error("Too few arguments provided");
			if (argsNum === 2) {
				cb = text;
				text = canvas;
				canvas = opts = void 0;
			} else if (argsNum === 3) {
				if (canvas.getContext && typeof cb === "undefined") {
					cb = opts;
					opts = void 0;
				} else {
					cb = opts;
					opts = text;
					text = canvas;
					canvas = void 0;
				}
			}
		} else {
			if (argsNum < 1) throw new Error("Too few arguments provided");
			if (argsNum === 1) {
				text = canvas;
				canvas = opts = void 0;
			} else if (argsNum === 2 && !canvas.getContext) {
				opts = text;
				text = canvas;
				canvas = void 0;
			}
			return new Promise(function(resolve, reject) {
				try {
					resolve(renderFunc(QRCode.create(text, opts), canvas, opts));
				} catch (e) {
					reject(e);
				}
			});
		}
		try {
			const data = QRCode.create(text, opts);
			cb(null, renderFunc(data, canvas, opts));
		} catch (e) {
			cb(e);
		}
	}
	exports.create = QRCode.create;
	exports.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
	exports.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
	exports.toString = renderCanvas.bind(null, function(data, _, opts) {
		return SvgRenderer.render(data, opts);
	});
})))(), 1);
const MARKS = {
	settings: {
		mode: "stroke",
		paths: ["M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"]
	},
	wechat: {
		mode: "fill",
		paths: ["M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213c0 .163.13.295.29.295a.33.33 0 0 0 .167-.054l1.903-1.114a.86.86 0 0 1 .717-.098a10.2 10.2 0 0 0 2.837.403c.276 0 .543-.027.811-.05c-.857-2.578.157-4.972 1.932-6.446c1.703-1.415 3.882-1.98 5.853-1.838c-.576-3.583-4.196-6.348-8.596-6.348M5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178a1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18m5.34 2.867c-1.797-.052-3.746.512-5.28 1.786c-1.72 1.428-2.687 3.72-1.78 6.22c.942 2.453 3.666 4.229 6.884 4.229c.826 0 1.622-.12 2.361-.336a.72.72 0 0 1 .598.082l1.584.926a.3.3 0 0 0 .14.047c.134 0 .24-.111.24-.247c0-.06-.023-.12-.038-.177l-.327-1.233a.6.6 0 0 1-.023-.156a.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983a.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983a.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982"]
	},
	wecom: {
		mode: "fill",
		paths: ["M17.3261 8.15754L17.3228 8.15069C17.0394 7.56412 16.6404 6.99422 16.1445 6.47713C14.8786 5.17033 13.0776 4.28741 11.0431 4.05986C10.673 4.01979 10.3047 4 9.94957 4C9.62263 4 9.27922 4.0193 8.91865 4.05952L8.91755 4.05965C6.85659 4.28839 5.03568 5.1673 3.77824 6.46538C3.27725 6.98775 2.87802 7.54898 2.58414 8.14712C2.19144 8.95433 2 9.79185 2 10.6574C2 11.7632 2.33191 12.875 2.98788 13.8581L2.99438 13.8678L2.99435 13.8679C3.38549 14.4616 4.08579 15.2583 4.63143 15.6982L5.61433 16.4906L5.40578 17.366L5.93277 17.0993L6.64094 16.7409L7.40215 16.9656C7.86891 17.1034 8.35651 17.1927 8.91862 17.2554L8.9244 17.256C9.26741 17.2953 9.60902 17.3149 9.94957 17.3149C10.3047 17.3149 10.6736 17.295 11.0448 17.2549C11.5031 17.2043 11.955 17.1167 12.3913 16.9973C12.4856 17.6972 12.8215 18.3342 13.3232 18.8066V18.8073H13.3231C12.6647 19.0154 11.9712 19.1649 11.2619 19.243C10.8205 19.2908 10.3791 19.3149 9.94957 19.3149C9.53203 19.3149 9.11448 19.2908 8.69693 19.243C8.05271 19.1712 7.44429 19.0634 6.83585 18.8838L3.99654 20.3207C3.99654 20.3207 3.70563 20.4523 3.55512 20.4523C3.13758 20.4523 2.85357 20.1671 2.85357 19.748C2.85357 19.4959 2.92051 19.1503 2.98248 18.9077L3.37618 17.2552C2.64845 16.6686 1.81334 15.7106 1.32422 14.9682C0.453338 13.663 0 12.1662 0 10.6574C0 9.48394 0.262458 8.34638 0.787376 7.2687C1.18106 6.46641 1.70599 5.73599 2.33827 5.0774C3.94881 3.41297 6.21551 2.34726 8.69693 2.07185C9.1264 2.02395 9.54395 2 9.94957 2C10.3791 2 10.8205 2.02395 11.2619 2.07185C13.7314 2.34726 15.9742 3.42495 17.5847 5.08937C18.217 5.74795 18.7419 6.49037 19.1237 7.28066C19.5895 8.22633 19.8926 9.2182 19.8928 10.2591C19.7117 10.1958 19.5219 10.1488 19.325 10.1201C18.8263 10.0474 18.3382 10.1001 17.8928 10.2544C17.8917 9.60962 17.7043 8.92531 17.3295 8.16436L17.3261 8.15754ZM21.4505 15.1352L21.4266 15.1113C21.4207 15.1053 21.4116 15.0992 21.4026 15.0932C21.3937 15.0873 21.3848 15.0813 21.3788 15.0754L21.2835 14.9796C20.6632 14.3569 20.2693 13.5906 20.1144 12.7883C20.1144 12.7626 20.1109 12.7369 20.1077 12.7131C20.1049 12.6925 20.1023 12.6732 20.1023 12.6566L20.0666 12.5129C20.0069 12.2854 19.8877 12.0698 19.7086 11.9022C19.1719 11.3633 18.2891 11.3633 17.7521 11.9022C17.2153 12.441 17.2153 13.3271 17.7521 13.866C17.943 14.0575 18.1697 14.1773 18.4203 14.2372C18.4442 14.2491 18.48 14.2491 18.5037 14.2491C18.5157 14.2491 18.5306 14.2521 18.5455 14.2551C18.5604 14.2581 18.5753 14.2611 18.5873 14.2611C19.4104 14.4168 20.1859 14.8119 20.8181 15.4465C20.8659 15.4945 20.9136 15.5424 20.9494 15.5902C21.0806 15.722 21.2835 15.722 21.4147 15.5902C21.546 15.4585 21.546 15.267 21.4505 15.1352ZM20.4001 19.5059L20.3762 19.5298C20.257 19.6257 20.0661 19.6257 19.9228 19.4938C19.7916 19.3622 19.7916 19.1586 19.9228 19.027C19.9701 18.9915 20.0171 18.9443 20.0643 18.8969L20.0643 18.8969L20.0661 18.8951C20.6983 18.2605 21.092 17.4823 21.2471 16.656C21.2471 16.6441 21.2501 16.6291 21.2531 16.6142L21.2531 16.6141C21.256 16.5992 21.259 16.5842 21.259 16.5721C21.259 16.5482 21.259 16.5123 21.271 16.4884C21.3307 16.2369 21.4499 16.0093 21.6408 15.8178C22.1776 15.2789 23.0606 15.2789 23.5973 15.8178C24.1341 16.3567 24.1341 17.2427 23.5973 17.7816C23.4303 17.9612 23.2155 18.081 22.9889 18.1408L22.8458 18.1768C22.8292 18.1768 22.8099 18.1793 22.7893 18.1821C22.7656 18.1853 22.74 18.1888 22.7145 18.1888C21.9151 18.3444 21.1517 18.7395 20.5313 19.3622L20.4359 19.4581C20.4299 19.464 20.4239 19.4731 20.4179 19.4821L20.4179 19.4821C20.4119 19.491 20.406 19.4999 20.4001 19.5059ZM16.0095 18.452L16.0334 18.4759C16.0394 18.4819 16.0484 18.488 16.0574 18.494L16.0575 18.4941C16.0663 18.5 16.0752 18.5059 16.081 18.5118L16.1765 18.6075C16.7969 19.2303 17.1905 19.9966 17.3457 20.7989C17.3457 20.8246 17.3491 20.8503 17.3522 20.8741L17.3523 20.8742C17.355 20.8948 17.3575 20.9141 17.3575 20.9307L17.3935 21.0743C17.453 21.3018 17.5723 21.5174 17.7514 21.685C18.2882 22.2239 19.171 22.2239 19.7078 21.685C20.2447 21.1461 20.2447 20.2601 19.7078 19.7212C19.517 19.5296 19.2903 19.4099 19.0397 19.35C19.0158 19.3381 18.9801 19.3381 18.9562 19.3381C18.9443 19.3381 18.9295 19.3351 18.9146 19.3321C18.8997 19.3291 18.8847 19.3261 18.8727 19.3261C18.0496 19.1705 17.2741 18.7753 16.6419 18.1407C16.5941 18.0927 16.5464 18.0448 16.5107 17.997C16.3794 17.8653 16.1765 17.8653 16.0453 17.997C15.9022 18.1286 15.9022 18.3322 16.0095 18.452ZM17.0476 14.0936L17.0715 14.0696C17.2027 13.9619 17.3936 13.9619 17.5248 14.1055C17.6561 14.2373 17.6561 14.4408 17.5248 14.5725C17.4777 14.608 17.4307 14.6551 17.3835 14.7023L17.3816 14.7043C16.7493 15.3389 16.3557 16.1172 16.2005 16.9435C16.2005 16.9554 16.1976 16.9704 16.1946 16.9854C16.1916 17.0003 16.1887 17.0153 16.1887 17.0272C16.1887 17.0513 16.1887 17.0872 16.1768 17.1111C16.1171 17.3626 15.9978 17.59 15.8069 17.7817C15.2701 18.3206 14.3872 18.3206 13.8504 17.7817C13.3135 17.2428 13.3135 16.3567 13.8504 15.8179C14.0174 15.6383 14.2321 15.5185 14.4588 15.4587L14.602 15.4227C14.6186 15.4227 14.6378 15.4201 14.6583 15.4174L14.6583 15.4174H14.6584C14.6821 15.4142 14.7076 15.4107 14.7332 15.4107C15.5325 15.2551 16.296 14.86 16.9163 14.2373L17.0118 14.1415C17.0179 14.1354 17.0239 14.1263 17.0299 14.1173C17.0358 14.1084 17.0417 14.0995 17.0476 14.0936Z"]
	},
	webhook: {
		mode: "stroke",
		paths: [
			"M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2",
			"m6 17l3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06",
			"m12 6l3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"
		]
	},
	bell: {
		mode: "stroke",
		paths: ["M10.268 21a2 2 0 0 0 3.464 0", "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"]
	}
};
/** One menu mark, sized to the label it sits above. */
function Mark(props) {
	const spec = MARKS[props.name];
	const size = props.size ?? 20;
	const color = props.color ?? "currentColor";
	if (spec.mode === "fill") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: color,
		"aria-hidden": "true",
		children: spec.paths.map((d) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d }, d))
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: color,
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: spec.paths.map((d) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d }, d))
	});
}
// src/client/rpc-contract.ts
/** Wire constants shared with the settings page. */
const RPC_CHANNEL = "/dsh-push-center";
/** Live event stream the page may hold open instead of polling. */
const EVENTS_PATH = "/dsh-push-center/events";
const RPC_ENDPOINTS = Object.freeze({
	configGet: "config.get",
	configSet: "config.set",
	status: "status",
	wechatRelogin: "wechat.relogin",
	wecomAibotQrStart: "wecom-aibot.qr-start",
	channelTest: "channel.test",
	systemProbe: "system.probe",
	systemPoll: "system.poll",
	systemDelivered: "system.delivered"
});
// src/core/renderer-queue.ts
/**
* Whether the page should act on one event.
*
* Two cursors guard it: the page's own in-memory one, and the one persisted in
* storage (which a second tab also writes). Both are checked because a poll and
* the page's own re-delivery can race within the same tick.
* @param eventId - the event being considered.
* @param memoryCursor - the last id this page instance handled.
* @param storedCursor - the last id persisted for this origin.
* @returns true when the event still needs handling.
*/
function shouldHandle(eventId, memoryCursor, storedCursor) {
	return eventId.length > 0 && eventId !== memoryCursor && eventId !== storedCursor;
}
/**
* Read one poll response.
*
* Kept pure and shared with the page: the page must handle the events it
* receives *before* adopting the cursor, otherwise a response carrying a single
* event looks already-seen and is dropped.
* @param payload - the `system.poll` result value.
* @param current - the cursor the page sent.
* @returns the events to handle and the cursor to use next.
*/
function readDrain(payload, current) {
	const value = payload;
	return {
		events: Array.isArray(value?.events) ? value.events : [],
		cursor: typeof value?.cursor === "string" && value.cursor.length > 0 ? value.cursor : current
	};
}
// src/client/system-notify.ts
/** Page-half system notifications: permission, live stream, polling fallback. */
/** Where the cursor survives a reload. */
const CURSOR_KEY = "dsh-push-center:notified";
/** Background polling cadence when the stream is unavailable. */
const POLL_MS = 3e3;
/**
* How long a silent stream may stay open before it is treated as dead.
* Must exceed the host's 15s keep-alive comment, or the page would abort every
* healthy stream before its first heartbeat and never use the live path.
*/
const STREAM_WATCHDOG_MS = 25e3;
/** Notification support on this page. */
function permissionOf() {
	if (typeof Notification === "undefined") return "unsupported";
	return Notification.permission;
}
/** Ask the browser for notification permission. */
async function requestPermission() {
	if (typeof Notification === "undefined") return "unsupported";
	if (Notification.permission === "granted") return "granted";
	return Notification.requestPermission();
}
/** Timbre of the cue: bright, short, and deliberately hard to miss. */
const CUE = {
	/** Two rising tones read as "done" rather than "alert". */
	frequencies: [1568, 2093],
	/** Peak gain per tone; the master keeps the pair from clipping. */
	peak: .45,
	master: .6,
	/** Near-instant attack gives the "ding" its click. */
	attack: .005,
	decay: .18,
	/** Gap between the two tones. */
	gap: .12
};
/** Whether the cue plays; the settings page owns this decision. */
let cueEnabled = true;
/**
* Turn the notification cue on or off.
* @param on - whether a cue should play with each notification.
*/
function setNotificationSound(on) {
	cueEnabled = on;
}
/**
* Play a short two-tone cue from the page.
*
* Browser notifications carry no sound setting beyond `silent`, and Chromium on
* macOS delivers them without a sound at all, so the page synthesizes its own.
* Failure is silent: a missing AudioContext must never break the notification.
*/
function playCue() {
	try {
		const Ctor = typeof AudioContext === "undefined" ? void 0 : AudioContext;
		if (Ctor === void 0) return;
		cue ??= new Ctor();
		const audio = cue;
		if (audio.state === "suspended") audio.resume();
		const start = audio.currentTime;
		const master = audio.createGain();
		master.gain.value = CUE.master;
		master.connect(audio.destination);
		for (const [index, frequency] of CUE.frequencies.entries()) {
			const at = start + index * CUE.gap;
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			osc.type = "triangle";
			osc.frequency.value = frequency;
			gain.gain.setValueAtTime(1e-4, at);
			gain.gain.exponentialRampToValueAtTime(CUE.peak, at + CUE.attack);
			gain.gain.exponentialRampToValueAtTime(1e-4, at + CUE.attack + CUE.decay);
			osc.connect(gain);
			gain.connect(master);
			osc.start(at);
			osc.stop(at + CUE.attack + CUE.decay + .02);
		}
	} catch {}
}
/** One shared audio context, created on first use. */
let cue;
/**
* Show one notification; formatting is the host's job.
* @returns whether a notification was actually raised, so the ledger can record it.
*/
function showNotification(title, body) {
	if (typeof Notification === "undefined") return false;
	if (Notification.permission !== "granted") return false;
	new Notification(title, {
		body,
		silent: false
	});
	if (cueEnabled) playCue();
	return true;
}
function readCursor() {
	try {
		return globalThis.localStorage?.getItem(CURSOR_KEY) ?? "";
	} catch {
		return "";
	}
}
function writeCursor(id) {
	try {
		globalThis.localStorage?.setItem(CURSOR_KEY, id);
	} catch {}
}
/**
* Follow system-notification events for this page.
*
* Nothing runs until the stored config says system notifications are enabled:
* a disabled profile opens no stream, starts no timer and sends no request
* beyond the one config read. When enabled, the page prefers the host's event
* stream and falls back to polling if the stream cannot be held open.
* @param options - RPC caller, state observer and notification override.
* @returns the stop function.
*/
/** One agent per page: a second start would double every notification. */
let runningAgent;
function startSystemNotifications(options) {
	if (runningAgent !== void 0) return runningAgent;
	const notify = options.notify ?? showNotification;
	let stopped = false;
	let controller;
	let pollTimer;
	let watchdog;
	let mode = "off";
	let cursor = readCursor();
	const setMode = (next, lastError) => {
		mode = next;
		options.onChange?.({
			mode,
			permission: permissionOf(),
			...lastError === void 0 ? {} : { lastError }
		});
	};
	const handle = (event) => {
		if (typeof event?.id !== "string") return;
		if (!shouldHandle(event.id, cursor, readCursor())) return;
		cursor = event.id;
		writeCursor(event.id);
		const shown = notify(event.title, event.body);
		options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemDelivered, {
			id: event.id,
			shown,
			...event.type === void 0 ? {} : { type: event.type }
		});
	};
	const drain = async () => {
		const result = await options.call(RPC_CHANNEL, RPC_ENDPOINTS.systemPoll, { since: cursor });
		if (!result.ok) throw new Error(result.error?.message ?? "poll failed");
		const drained = readDrain(result.value, cursor);
		for (const event of drained.events) handle(event);
		if (drained.cursor !== cursor) {
			cursor = drained.cursor;
			writeCursor(cursor);
		}
	};
	const startPolling = (reason) => {
		if (stopped) return;
		setMode("poll", reason);
		const loop = async () => {
			if (stopped) return;
			try {
				await drain();
			} catch (error) {
				if (!stopped) options.onChange?.({
					mode,
					permission: permissionOf(),
					lastError: error instanceof Error ? error.message : String(error)
				});
			}
			if (stopped) return;
			pollTimer = setTimeout(() => {
				loop();
			}, POLL_MS);
		};
		loop();
	};
	const startStream = async () => {
		if (stopped) return;
		controller = new AbortController();
		const response = await fetch(EVENTS_PATH, {
			method: "GET",
			headers: { accept: "text/event-stream" },
			signal: controller.signal
		});
		if (!response.ok || response.body === null) throw new Error("stream rejected: HTTP " + String(response.status));
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		let opened = false;
		const arm = () => {
			if (watchdog !== void 0) clearTimeout(watchdog);
			watchdog = setTimeout(() => {
				controller?.abort();
			}, STREAM_WATCHDOG_MS);
		};
		arm();
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			if (!opened) {
				opened = true;
				setMode("stream");
			}
			arm();
			buffer += decoder.decode(value, { stream: true });
			let boundary = buffer.indexOf("\n\n");
			while (boundary !== -1) {
				const chunk = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data:")) continue;
					try {
						handle(JSON.parse(line.slice(5).trim()));
					} catch {}
				}
				boundary = buffer.indexOf("\n\n");
			}
		}
		if (!stopped) startPolling("stream closed");
	};
	(async () => {
		const config = await options.call(RPC_CHANNEL, RPC_ENDPOINTS.configGet, {});
		if (stopped) return;
		if (!config.ok) {
			setMode("off", config.error?.message ?? "config unavailable");
			return;
		}
		const settings = config.value?.system;
		setNotificationSound(settings?.sound !== false);
		if (!(settings?.enabled === true)) {
			setMode("off");
			return;
		}
		if (permissionOf() === "unsupported") {
			setMode("off", "this page has no Notification API");
			return;
		}
		try {
			await startStream();
		} catch (error) {
			if (!stopped) startPolling(error instanceof Error ? error.message : String(error));
		}
	})();
	const stop = () => {
		stopped = true;
		runningAgent = void 0;
		if (pollTimer !== void 0) clearTimeout(pollTimer);
		if (watchdog !== void 0) clearTimeout(watchdog);
		controller?.abort();
	};
	runningAgent = stop;
	return stop;
}
// src/client/SettingsPage.tsx
/** The Push settings page: a channel menu on the left, one topic on the right. */
/**
* Menu entries: one topic per entry, icon above the label.
*
* The first two are fixed: every build has global settings and OS notifications.
* Everything after them belongs to a chat channel, so a later release may add,
* remove or reorder those without touching the fixed pair.
*/
const FIXED_SECTIONS = [{
	id: "general",
	mark: "settings",
	label: "tabs.general"
}, {
	id: "system",
	mark: "bell",
	label: "tabs.system"
}];
/** Chat-channel sections; version-dependent, appended after the fixed pair. */
const CHANNEL_SECTIONS = [
	{
		id: "wechat",
		mark: "wechat",
		label: "tabs.wechat"
	},
	{
		id: "wecom-aibot",
		mark: "wecom",
		label: "tabs.wecomAibot"
	},
	{
		id: "wecom-webhook",
		mark: "webhook",
		label: "tabs.wecomWebhook"
	}
];
const SECTIONS = [...FIXED_SECTIONS, ...CHANNEL_SECTIONS];
/** Brand colours, so the two chat platforms are recognisable at a glance. */
const MARK_COLOR = {
	wechat: "#07C160",
	wecom: "#2B7BF2"
};
/** Event switches, shared by the chat toggles and the system toggles. */
const EVENT_KEYS = [
	"conversationCompleted",
	"conversationPaused",
	"conversationFailed",
	"authorizationRequired",
	"confirmationRequired",
	"todoProgress"
];
const BORDER = "1px solid var(--dsw-alias-border-secondary, #e5e7eb)";
const S = {
	layout: {
		display: "flex",
		alignItems: "flex-start",
		gap: "12px",
		padding: "2px 0",
		minWidth: 0
	},
	nav: {
		display: "flex",
		flexDirection: "column",
		gap: "4px",
		flex: "0 0 92px",
		width: "92px",
		position: "sticky",
		top: 0,
		alignSelf: "flex-start",
		flexShrink: 0
	},
	navItem: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "3px",
		padding: "7px 4px",
		borderRadius: "8px",
		border: "1px solid transparent",
		background: "transparent",
		color: "inherit",
		cursor: "pointer",
		fontSize: "11px",
		lineHeight: 1.25,
		textAlign: "center"
	},
	navItemActive: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "3px",
		padding: "7px 4px",
		borderRadius: "8px",
		border: BORDER,
		background: "var(--dsw-alias-bg-secondary, rgba(127,127,127,0.08))",
		color: "inherit",
		cursor: "pointer",
		fontSize: "11px",
		lineHeight: 1.25,
		textAlign: "center",
		fontWeight: 600
	},
	navIcon: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		lineHeight: 0
	},
	content: {
		display: "flex",
		flexDirection: "column",
		gap: "12px",
		flex: "1 1 auto",
		minWidth: 0,
		minHeight: 0,
		maxHeight: "min(68vh, 600px)",
		overflowY: "auto",
		overscrollBehavior: "contain",
		paddingRight: "4px"
	},
	section: {
		border: BORDER,
		borderRadius: "10px",
		padding: "14px 16px",
		display: "flex",
		flexDirection: "column",
		gap: "2px"
	},
	header: {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		margin: "0 0 10px"
	},
	heading: {
		margin: 0,
		fontSize: "15px",
		fontWeight: 600
	},
	row: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "12px",
		padding: "6px 0"
	},
	field: {
		display: "flex",
		flexDirection: "column",
		gap: "4px",
		padding: "6px 0"
	},
	label: {
		fontSize: "13px",
		opacity: .9
	},
	hint: {
		fontSize: "12px",
		opacity: .55,
		marginTop: "2px",
		lineHeight: 1.45
	},
	input: {
		width: "100%",
		boxSizing: "border-box",
		padding: "6px 8px",
		borderRadius: "6px",
		border: "1px solid var(--dsw-alias-border-secondary, #d4d4d8)",
		background: "transparent",
		color: "inherit",
		fontSize: "13px"
	},
	actions: {
		display: "flex",
		alignItems: "flex-start",
		gap: "16px",
		flexWrap: "wrap",
		marginTop: "6px"
	},
	action: {
		display: "flex",
		flexDirection: "column",
		alignItems: "flex-start",
		gap: "4px",
		minWidth: "96px"
	},
	note: {
		fontSize: "12px",
		opacity: .6,
		minHeight: "16px",
		maxWidth: "100%",
		overflowWrap: "anywhere",
		lineHeight: 1.45
	},
	button: {
		padding: "6px 14px",
		borderRadius: "7px",
		border: "1px solid var(--dsw-alias-border-secondary, #d4d4d8)",
		background: "transparent",
		color: "inherit",
		cursor: "pointer",
		fontSize: "13px"
	},
	primary: {
		padding: "6px 16px",
		borderRadius: "7px",
		border: "1px solid transparent",
		background: "var(--dsw-alias-bg-accent, #2563eb)",
		color: "#fff",
		cursor: "pointer",
		fontSize: "13px"
	},
	state: {
		fontSize: "12px",
		padding: "1px 8px",
		borderRadius: "999px",
		border: "1px solid currentColor",
		opacity: .8
	},
	switch: {
		position: "relative",
		display: "inline-flex",
		alignItems: "center",
		flex: "0 0 auto",
		width: "36px",
		height: "20px",
		borderRadius: "999px",
		background: "var(--dsw-alias-bg-secondary, rgba(127,127,127,0.32))",
		border: "1px solid var(--dsw-alias-border-secondary, #d4d4d8)",
		transition: "background 120ms ease",
		boxSizing: "border-box"
	},
	switchOn: {
		background: "var(--dsw-alias-bg-accent, #2563eb)",
		borderColor: "transparent"
	},
	switchFocus: {
		outline: "2px solid var(--dsw-alias-bg-accent, #2563eb)",
		outlineOffset: "2px"
	},
	switchInput: {
		position: "absolute",
		inset: 0,
		width: "100%",
		height: "100%",
		margin: 0,
		opacity: 0,
		cursor: "pointer",
		appearance: "none"
	},
	knob: {
		position: "absolute",
		left: "2px",
		width: "14px",
		height: "14px",
		borderRadius: "50%",
		background: "#fff",
		boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
		transition: "transform 120ms ease",
		pointerEvents: "none"
	},
	knobOn: { transform: "translateX(16px)" },
	qr: {
		width: "150px",
		height: "150px",
		border: BORDER,
		borderRadius: "8px",
		marginTop: "8px"
	},
	footer: {
		display: "flex",
		alignItems: "flex-start",
		gap: "14px",
		paddingTop: "4px"
	}
};
/** Text input bound to one config path. */
function Field(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
		style: S.field,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.label,
				children: props.label
			}),
			props.hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: props.hint
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				style: S.input,
				value: props.value,
				placeholder: props.placeholder ?? "",
				onChange: (event) => props.onChange(event.target.value)
			})
		]
	});
}
/** Switch bound to one boolean config path. */
function Toggle(props) {
	const [focused, setFocused] = (0, react.useState)(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
		style: S.row,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: S.label,
			children: props.label
		}), props.hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: S.hint,
			children: props.hint
		})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
			style: {
				...S.switch,
				...props.checked ? S.switchOn : {},
				...focused ? S.switchFocus : {}
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				type: "checkbox",
				style: S.switchInput,
				checked: props.checked,
				onChange: (event) => props.onChange(event.target.checked),
				onFocus: () => setFocused(true),
				onBlur: () => setFocused(false)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
				...S.knob,
				...props.checked ? S.knobOn : {}
			} })]
		})]
	});
}
/** Comma separated list field. */
function ListField(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
		label: props.label,
		...props.hint === void 0 ? {} : { hint: props.hint },
		value: props.value.join(", "),
		onChange: (text) => props.onChange(text.split(",").map((part) => part.trim()).filter((part) => part.length > 0))
	});
}
/** The page component. */
function SettingsPage(props) {
	const { t, rpcCall, channel, endpoints } = props;
	const [section, setSection] = (0, react.useState)("general");
	const [config, setConfig] = (0, react.useState)(null);
	const [draft, setDraft] = (0, react.useState)(null);
	const [status, setStatus] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)(null);
	const [permission, setPermission] = (0, react.useState)(() => permissionOf());
	const [saving, setSaving] = (0, react.useState)(false);
	const [saved, setSaved] = (0, react.useState)(false);
	const [qrImage, setQrImage] = (0, react.useState)(null);
	const [aibotQr, setAibotQr] = (0, react.useState)(null);
	const [notes, setNotes] = (0, react.useState)({});
	const draftRef = (0, react.useRef)(null);
	const configRef = (0, react.useRef)(null);
	const revisionRef = (0, react.useRef)(-1);
	draftRef.current = draft;
	configRef.current = config;
	/** Adopt a config the host changed on its own (association, relogin). */
	const adoptServerConfig = (0, react.useCallback)((next) => {
		const before = configRef.current;
		const editing = before !== null && draftRef.current !== null && JSON.stringify(before) !== JSON.stringify(draftRef.current);
		setConfig(next);
		if (!editing) {
			setDraft(next);
			return;
		}
		setDraft((current) => current === null ? next : {
			...current,
			channels: {
				...current.channels,
				"wecom-aibot": {
					...current.channels["wecom-aibot"],
					botId: next.channels["wecom-aibot"].botId,
					secret: next.channels["wecom-aibot"].secret
				}
			}
		});
	}, []);
	const loadStatus = (0, react.useCallback)(async () => {
		const result = await rpcCall(channel, endpoints.status, {});
		if (!result.ok || result.value === void 0) return;
		const payload = result.value;
		setStatus(payload);
		const revision = typeof payload.revision === "number" ? payload.revision : 0;
		if (revisionRef.current !== -1 && revision !== revisionRef.current) {
			revisionRef.current = revision;
			const refreshed = await rpcCall(channel, endpoints.configGet, {});
			if (refreshed.ok && refreshed.value !== void 0) adoptServerConfig(refreshed.value);
			return;
		}
		revisionRef.current = revision;
	}, [
		rpcCall,
		channel,
		endpoints.status,
		endpoints.configGet,
		adoptServerConfig
	]);
	const load = (0, react.useCallback)(async () => {
		const result = await rpcCall(channel, endpoints.configGet, {});
		if (!result.ok) {
			setError(result.error?.message ?? t("loadFailed"));
			return;
		}
		setConfig(result.value);
		setDraft(result.value);
		await loadStatus();
	}, [
		rpcCall,
		channel,
		endpoints.configGet,
		loadStatus,
		t
	]);
	(0, react.useEffect)(() => {
		load();
	}, [load]);
	const wechatStatus = status?.channels.find((item) => item.id === "wechat");
	const aibotStatus = status?.channels.find((item) => item.id === "wecom-aibot");
	const webhookStatus = status?.channels.find((item) => item.id === "wecom-webhook");
	const systemStatus = status?.channels.find((item) => item.id === "system");
	status?.system;
	const qrUrl = wechatStatus?.qr?.url;
	(0, react.useEffect)(() => {
		if (qrUrl === void 0) {
			setQrImage(null);
			return;
		}
		let cancelled = false;
		import_browser.toDataURL(qrUrl, {
			width: 320,
			margin: 1
		}).then((data) => {
			if (!cancelled) setQrImage(data);
		}).catch(() => {
			if (!cancelled) setQrImage(null);
		});
		return () => {
			cancelled = true;
		};
	}, [qrUrl]);
	const associationUrl = status?.association?.phase === "pending" ? status.association.url : void 0;
	(0, react.useEffect)(() => {
		if (associationUrl === void 0) {
			setAibotQr(null);
			return;
		}
		let cancelled = false;
		import_browser.toDataURL(associationUrl, {
			width: 320,
			margin: 1
		}).then((data) => {
			if (!cancelled) setAibotQr(data);
		}).catch(() => {
			if (!cancelled) setAibotQr(null);
		});
		return () => {
			cancelled = true;
		};
	}, [associationUrl]);
	(0, react.useEffect)(() => {
		const timer = setInterval(() => {
			loadStatus();
		}, 3e3);
		return () => {
			clearInterval(timer);
		};
	}, [loadStatus]);
	const stateLabel = (value) => value === void 0 ? "" : t("state." + value);
	const associationDone = status?.association?.phase === "idle" && status.association.completedAt !== void 0;
	const associationError = status?.association?.phase === "error" ? t("wecomAibot.qr" + (status.association.errorKey === "expired" ? "Expired" : status.association.errorKey === "timeout" ? "Timeout" : "Failed")) : null;
	const dirty = (0, react.useMemo)(() => config !== null && draft !== null && JSON.stringify(config) !== JSON.stringify(draft), [config, draft]);
	/** One action: the button, and its own line underneath for the outcome. */
	const action = (key, label, onClick, primary = false) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: S.action,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			style: primary ? S.primary : S.button,
			onClick,
			children: label
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: S.note,
			children: notes[key] ?? ""
		})]
	});
	const say = (key, text) => {
		setNotes((prev) => ({
			...prev,
			[key]: text
		}));
	};
	const save = async () => {
		if (draft === null) return;
		setSaving(true);
		setError(null);
		const result = await rpcCall(channel, endpoints.configSet, draft);
		setSaving(false);
		if (!result.ok) {
			say("save", result.error?.message ?? t("saveFailed"));
			return;
		}
		setConfig(result.value);
		setDraft(result.value);
		setNotificationSound(result.value.system.sound);
		setSaved(true);
		say("save", t("saved"));
		setTimeout(() => {
			setSaved(false);
		}, 2e3);
		await loadStatus();
	};
	const wechatBound = wechatStatus?.bound === true;
	const startWechatBind = async () => {
		say("wechat.bind", t("loading"));
		const result = await rpcCall(channel, endpoints.wechatRelogin, {});
		if (!result.ok) {
			say("wechat.bind", result.error?.message ?? t("common.unknown"));
			return;
		}
		say("wechat.bind", t("wechat.loginStarted"));
		await loadStatus();
	};
	const runTest = async (id) => {
		say("test." + id, t("loading"));
		const result = await rpcCall(channel, endpoints.channelTest, { channel: id });
		if (!result.ok) {
			say("test." + id, result.error?.message ?? t("channel.testFailed"));
			return;
		}
		const value = result.value;
		const text = value.ok === true ? t("channel.testOk") : value.code === "no-target" ? t("channel.noTargetHint") : value.error ?? value.code ?? t("channel.testFailed");
		say("test." + id, text);
	};
	const startAibotQr = async () => {
		say("wecom-aibot.qr", t("loading"));
		const result = await rpcCall(channel, endpoints.wecomAibotQrStart, {});
		if (!result.ok) {
			say("wecom-aibot.qr", result.error?.message ?? t("common.unknown"));
			return;
		}
		say("wecom-aibot.qr", t("wecomAibot.qrStarted"));
		await loadStatus();
	};
	if (error !== null && draft === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
		t("loadFailed"),
		": ",
		error
	] });
	if (draft === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") });
	const update = (next) => {
		setDraft(next);
	};
	const patchTop = (key, value) => update({
		...draft,
		[key]: value
	});
	const patchChannel = (id, key, value) => {
		const channels = {
			...draft.channels,
			[id]: {
				...draft.channels[id],
				[key]: value
			}
		};
		update({
			...draft,
			channels
		});
	};
	/** Header: title plus the live state of that channel. */
	const header = (title, state) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: S.header,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
			style: S.heading,
			children: title
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: S.state,
			children: stateLabel(state)
		})]
	});
	const knownChats = (list) => (list ?? []).map((target) => target.id).join(", ") || t("channel.noTargetHint");
	const targetsLine = (list) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: S.hint,
		children: [
			t("channel.knownChats"),
			": ",
			knownChats(list)
		]
	});
	const generalSection = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			style: S.section,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: S.heading,
						children: t("global.section")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
					label: t("global.enabled"),
					hint: t("global.enabledHint"),
					checked: draft.enabled,
					onChange: (value) => patchTop("enabled", value)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: t("global.titlePrefix"),
					hint: t("global.titlePrefixHint"),
					value: draft.titlePrefix,
					onChange: (value) => patchTop("titlePrefix", value)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
					label: t("global.mainAgentOnly"),
					hint: t("global.mainAgentOnlyHint"),
					checked: draft.mainAgentOnly,
					onChange: (value) => patchTop("mainAgentOnly", value)
				})
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			style: S.section,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: S.heading,
						children: t("defaultChannel.title")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.hint,
					children: t("defaultChannel.hint")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					style: S.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: S.label,
						children: t("defaultChannel.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						style: S.input,
						value: draft.push.defaultChannel,
						onChange: (event) => update({
							...draft,
							push: {
								...draft.push,
								defaultChannel: event.target.value
							}
						}),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("defaultChannel.auto")
							}),
							draft.channels.wechat.enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "wechat",
								children: t("wechat.title")
							}) : null,
							draft.channels["wecom-aibot"].enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "wecom-aibot",
								children: t("wecomAibot.title")
							}) : null,
							draft.channels["wecom-webhook"].enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "wecom-webhook",
								children: t("wecomWebhook.title")
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
					label: t("push.replyTimeout"),
					hint: t("push.replyTimeoutHint"),
					value: String(draft.push.replyTimeoutMs),
					onChange: (value) => update({
						...draft,
						push: {
							...draft.push,
							replyTimeoutMs: Number(value) || 12e4
						}
					})
				})
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			style: S.section,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: S.heading,
						children: t("deliveries.title")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.hint,
					children: t("deliveries.hint")
				}),
				(status?.deliveries ?? []).slice(0, 20).map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.hint,
					children: new Date(row.at).toLocaleTimeString() + " · " + row.channel + (row.target.length === 0 ? "" : "/" + row.target) + " · " + (row.ok ? t("deliveries.ok") : t("deliveries.failed")) + (row.code === void 0 ? "" : " (" + row.code + ")")
				}, String(row.at) + "-" + String(index))),
				(status?.deliveries?.length ?? 0) === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.hint,
					children: t("deliveries.empty")
				}) : null
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			style: S.section,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: S.heading,
						children: t("events.section")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.hint,
					children: t("events.hint")
				}),
				EVENT_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
					label: t("events." + key),
					checked: draft.events[key],
					onChange: (value) => update({
						...draft,
						events: {
							...draft.events,
							[key]: value
						}
					})
				}, key))
			]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			style: S.section,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: S.header,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: S.heading,
						children: t("messages.section")
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					style: S.field,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: S.label,
							children: t("messages.locale")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: S.hint,
							children: t("messages.localeHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							style: S.input,
							value: draft.messages.locale,
							onChange: (event) => update({
								...draft,
								messages: {
									...draft.messages,
									locale: event.target.value === "en" ? "en" : "zh"
								}
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "zh",
								children: t("language.zh")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "en",
								children: t("language.en")
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
					label: t("messages.hint"),
					hint: t("messages.hintHint"),
					checked: draft.messages.hint,
					onChange: (value) => update({
						...draft,
						messages: {
							...draft.messages,
							hint: value
						}
					})
				})
			]
		})
	] });
	const wechatSection = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: S.section,
		children: [
			header(t("wechat.title"), wechatStatus?.state),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("wechat.enabled"),
				checked: draft.channels.wechat.enabled,
				onChange: (value) => patchChannel("wechat", "enabled", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("wechat.interactive"),
				hint: t("wechat.interactiveHint"),
				checked: draft.channels.wechat.interactive,
				onChange: (value) => patchChannel("wechat", "interactive", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
				label: t("wechat.defaultTargets"),
				hint: t("wechat.defaultTargetsHint"),
				value: draft.channels.wechat.defaultTargets,
				onChange: (value) => patchChannel("wechat", "defaultTargets", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: S.actions,
				children: [action("wechat.bind", wechatBound ? t("wechat.relogin") : t("wechat.bind"), () => {
					startWechatBind();
				}), action("test.wechat", t("channel.test"), () => {
					runTest("wechat");
				})]
			}),
			qrImage === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				src: qrImage,
				alt: "QR",
				style: S.qr
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: t("wechat.scanHint")
			})] }),
			targetsLine(wechatStatus?.targets)
		]
	});
	const aibotSection = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: S.section,
		children: [
			header(t("wecomAibot.title"), aibotStatus?.state),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("wecomAibot.enabled"),
				checked: draft.channels["wecom-aibot"].enabled,
				onChange: (value) => patchChannel("wecom-aibot", "enabled", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("wecomAibot.interactive"),
				hint: t("wecomAibot.interactiveHint"),
				checked: draft.channels["wecom-aibot"].interactive,
				onChange: (value) => patchChannel("wecom-aibot", "interactive", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
				label: t("wecomAibot.botId"),
				value: draft.channels["wecom-aibot"].botId,
				onChange: (value) => patchChannel("wecom-aibot", "botId", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
				label: t("wecomAibot.secret"),
				value: draft.channels["wecom-aibot"].secret,
				onChange: (value) => patchChannel("wecom-aibot", "secret", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
				label: t("wecomAibot.defaultTargets"),
				hint: t("wecomAibot.defaultTargetsHint"),
				value: draft.channels["wecom-aibot"].defaultTargets,
				onChange: (value) => patchChannel("wecom-aibot", "defaultTargets", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: S.actions,
				children: [action("wecom-aibot.qr", aibotStatus?.bound === true ? t("wecomAibot.qrRelink") : t("wecomAibot.qrStart"), () => {
					startAibotQr();
				}), action("test.wecom-aibot", t("channel.test"), () => {
					runTest("wecom-aibot");
				})]
			}),
			associationError === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: associationError
			}),
			associationDone ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: t("wecomAibot.qrDone")
			}) : null,
			aibotQr === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				src: aibotQr,
				alt: "QR",
				style: S.qr
			}),
			targetsLine(aibotStatus?.targets)
		]
	});
	const webhookSection = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: S.section,
		children: [
			header(t("wecomWebhook.title"), webhookStatus?.state),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("wecomWebhook.enabled"),
				checked: draft.channels["wecom-webhook"].enabled,
				onChange: (value) => patchChannel("wecom-webhook", "enabled", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
				label: t("wecomWebhook.webhookUrl"),
				hint: t("wecomWebhook.webhookUrlHint"),
				value: draft.channels["wecom-webhook"].webhookUrl,
				onChange: (value) => patchChannel("wecom-webhook", "webhookUrl", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ListField, {
				label: t("wecomWebhook.mentions"),
				hint: t("wecomWebhook.mentionsHint"),
				value: draft.channels["wecom-webhook"].mentions,
				onChange: (value) => patchChannel("wecom-webhook", "mentions", value)
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.actions,
				children: action("test.wecom-webhook", t("channel.test"), () => {
					runTest("wecom-webhook");
				})
			})
		]
	});
	const verifyRow = (label, value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: S.row,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: S.label,
			children: label
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: S.hint,
			children: value
		})]
	});
	const permissionLabel = permission === "granted" ? t("system.permissionGranted") : permission === "denied" ? t("system.permissionDenied") : permission === "unsupported" ? t("system.permissionUnsupported") : t("system.permissionDefault");
	const askPermission = async () => {
		const next = await requestPermission();
		setPermission(next);
		say("system.permission", next === "granted" ? t("system.permissionGranted") : t("system.guidanceBrowser"));
	};
	const sendTestNotification = async () => {
		if (permission !== "granted") {
			const next = await requestPermission();
			setPermission(next);
			if (next !== "granted") {
				say("system.test", t("system.guidanceBrowser"));
				return;
			}
		}
		const shown = showNotification(t("system.testTitle"), t("system.testBody") + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString());
		say("system.test", shown ? t("system.testSent") : t("system.guidanceBrowser"));
	};
	const systemSection = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		style: S.section,
		children: [
			header(t("system.title"), systemStatus?.state),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: S.section,
				children: [verifyRow(t("system.permission"), permissionLabel), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: S.actions,
					children: [action("system.permission", t("system.requestPermission"), () => {
						askPermission();
					}), action("system.test", t("system.testNotification"), () => {
						sendTestNotification();
					}, true)]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("system.enabled"),
				hint: t("system.enabledHint"),
				checked: draft.system.enabled,
				onChange: (value) => update({
					...draft,
					system: {
						...draft.system,
						enabled: value
					}
				})
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("system.sound"),
				hint: t("system.soundHint"),
				checked: draft.system.sound,
				onChange: (value) => {
					setNotificationSound(value);
					update({
						...draft,
						system: {
							...draft.system,
							sound: value
						}
					});
				}
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.label,
				children: t("system.events")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: t("system.eventsHint")
			}),
			EVENT_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Toggle, {
				label: t("events." + key),
				checked: draft.system.events[key],
				onChange: (value) => update({
					...draft,
					system: {
						...draft.system,
						events: {
							...draft.system.events,
							[key]: value
						}
					}
				})
			}, key)),
			systemStatus?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: S.hint,
				children: systemStatus.error
			})
		]
	});
	const body = section === "general" ? generalSection : section === "wechat" ? wechatSection : section === "wecom-aibot" ? aibotSection : section === "system" ? systemSection : webhookSection;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		style: S.layout,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
			style: S.nav,
			"data-role": "nav",
			children: SECTIONS.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				style: section === item.id ? S.navItemActive : S.navItem,
				onClick: () => {
					setSection(item.id);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: S.navIcon,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Mark, {
						name: item.mark,
						size: 18,
						...MARK_COLOR[item.mark] === void 0 ? {} : { color: MARK_COLOR[item.mark] }
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(item.label) })]
			}, item.id))
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: S.content,
			"data-role": "content",
			children: [body, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: S.footer,
				children: [
					action("save", saving ? t("saving") : t("save"), () => {
						save();
					}, true),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							...S.note,
							minHeight: "16px"
						},
						children: saved ? t("saved") : dirty ? t("dirty") : ""
					}),
					error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							...S.note,
							color: "var(--dsw-alias-text-danger, #dc2626)"
						},
						children: error
					})
				]
			})]
		})]
	});
}
// locale/zh.json
var ui$1 = {
	"nav": "推送",
	"page": {
		"title": "推送",
		"hint": "配置推送通道、默认去向与触发事件。修改后点击「保存」立即生效。"
	},
	"loading": "加载中…",
	"loadFailed": "无法加载推送配置",
	"save": "保存",
	"saving": "保存中…",
	"saved": "已保存",
	"saveFailed": "保存失败",
	"dirty": "有未保存的修改",
	"global": {
		"section": "通用",
		"enabled": "启用推送",
		"enabledHint": "关闭后不再发送任何通知，也不响应聊天指令",
		"titlePrefix": "标题前缀",
		"titlePrefixHint": "追加在每条通知标题前，例如 [DSH]；留空不加",
		"mainAgentOnly": "仅主智能体",
		"mainAgentOnlyHint": "子智能体的完成/进度保持静默；需要人回复的授权与提问不受影响"
	},
	"events": {
		"section": "触发事件",
		"hint": "选择哪些事件会触发推送。",
		"conversationCompleted": "对话完成",
		"conversationPaused": "对话暂停",
		"conversationFailed": "对话失败",
		"authorizationRequired": "需要授权",
		"confirmationRequired": "需要回答",
		"todoProgress": "任务进度"
	},
	"channels": {
		"section": "通道",
		"hint": "至少启用一个通道并填写完整凭据后才会开始推送。"
	},
	"wechat": {
		"title": "微信",
		"enabled": "启用微信机器人",
		"interactive": "允许在微信里应答",
		"interactiveHint": "关闭后只推送，不处理回复",
		"defaultTargets": "默认收件人",
		"defaultTargetsHint": "留空则发给最近说过话的人",
		"login": "扫码登录",
		"relogin": "重新登录",
		"logout": "退出登录",
		"scanHint": "用微信扫描二维码登录；登录后请先给机器人发一条消息，之后才能主动推送。",
		"targets": "已知收件人",
		"noTargets": "还没有人给机器人发过消息",
		"bind": "扫码绑定",
		"loginStarted": "已开始登录，二维码稍后出现",
		"disabledHint": "未启用（点「扫码绑定」会自动启用并开始扫码）"
	},
	"wecomAibot": {
		"title": "企业微信智能机器人",
		"enabled": "启用智能机器人",
		"interactive": "允许在企业微信里应答",
		"interactiveHint": "关闭后只推送，不处理回复",
		"botId": "Bot ID",
		"secret": "Secret",
		"defaultTargets": "默认会话",
		"defaultTargetsHint": "单聊填 userid，群聊填 chatid；留空则发给最近说过话的会话",
		"qrStart": "扫码关联",
		"qrHint": "用企业微信扫码自动填入 Bot ID 与 Secret",
		"status": "连接状态",
		"qrExpired": "二维码已过期，请重新发起",
		"qrTimeout": "扫码关联超时，请重试",
		"qrFailed": "扫码关联失败",
		"qrDone": "已关联，Bot ID 与 Secret 已自动填入",
		"qrRelink": "重新关联",
		"qrStarted": "已发起关联，二维码稍后出现"
	},
	"wecomWebhook": {
		"title": "企业微信群机器人",
		"enabled": "启用群机器人",
		"webhookUrl": "Webhook 地址",
		"webhookUrlHint": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
		"mentions": "提醒成员",
		"mentionsHint": "填 userid 或 @all，用逗号分隔；仅文本消息生效",
		"msgType": "消息类型"
	},
	"defaultChannel": {
		"title": "默认通道",
		"hint": "主动推送不指定通道时只发到这里；该通道不可用时直接报失败，不会改发其他通道。",
		"auto": "自动（第一个启用且配置完整的通道）"
	},
	"push": {
		"section": "主动推送",
		"replyTimeout": "等待回复超时（毫秒）",
		"replyTimeoutHint": "push_message 要求回复时最长等待时间，上限 300000"
	},
	"messages": {
		"section": "聊天文案",
		"locale": "聊天语言",
		"localeHint": "推送到聊天里的文案语言，与设置页语言无关",
		"hint": "附回复提示",
		"hintHint": "在通知末尾附一行「回复即可继续本会话」"
	},
	"state": {
		"ready": "已连接",
		"opening": "连接中",
		"degraded": "降级",
		"error": "出错",
		"closed": "未启动",
		"disabled": "未启用"
	},
	"common": {
		"cancel": "取消",
		"retry": "重试",
		"none": "无",
		"unknown": "未知错误"
	},
	"language": {
		"zh": "中文",
		"en": "English"
	},
	"channel": {
		"test": "发送测试",
		"testOk": "测试消息已发出",
		"testFailed": "测试失败",
		"noTargetHint": "还没有已知会话：先给机器人发一条消息",
		"knownChats": "已知会话"
	},
	"tabs": {
		"general": "全局设置",
		"wechat": "微信",
		"wecomAibot": "企业微信",
		"wecomWebhook": "群机器人",
		"system": "系统通知"
	},
	"deliveries": {
		"title": "最近投递",
		"hint": "每条出站尝试一行：时间 · 渠道/目标 · 结果。用它能确认消息到底有没有发出去。",
		"ok": "成功",
		"failed": "失败",
		"empty": "还没有投递记录。"
	},
	"system": {
		"title": "系统通知",
		"enabled": "启用系统通知",
		"enabledHint": "会话事件直接弹到操作系统通知中心（macOS / Linux / Windows），不经过微信或企微。",
		"sound": "提示音",
		"soundHint": "收到系统通知时播放一声短提示音（页面自己合成，不依赖系统通知音；页面关闭时不响）",
		"events": "哪些事件弹系统通知",
		"eventsHint": "与「全局设置」里的事件勾选互不影响：这里只决定哪些事件额外弹一条系统通知。",
		"permission": "授权状态",
		"permissionGranted": "已授权",
		"permissionDefault": "未请求",
		"permissionDenied": "已拒绝",
		"permissionUnsupported": "此页面不支持通知",
		"requestPermission": "请求授权",
		"testNotification": "发送测试",
		"testSent": "已发送",
		"testTitle": "🧪 DSH 系统通知测试",
		"testBody": "这条来自 DSH 推送中心；能看到就说明通知已打通。",
		"guidanceBrowser": "没收到就检查两处：浏览器地址栏左侧的站点设置里允许通知；系统设置里允许对应的浏览器（macOS：系统设置 → 通知 → 你的浏览器；Windows：设置 → 系统 → 通知）。"
	}
};
// locale/en.json
var ui = {
	"nav": "Push",
	"page": {
		"title": "Push",
		"hint": "Configure channels, default routing and triggers. Save applies immediately."
	},
	"loading": "Loading…",
	"loadFailed": "Could not load the push configuration",
	"save": "Save",
	"saving": "Saving…",
	"saved": "Saved",
	"saveFailed": "Save failed",
	"dirty": "Unsaved changes",
	"global": {
		"section": "General",
		"enabled": "Enable push",
		"enabledHint": "When off, no notification is sent and chat commands are ignored",
		"titlePrefix": "Title prefix",
		"titlePrefixHint": "Prepended to every notification title, e.g. [DSH]; leave empty for none",
		"mainAgentOnly": "Main agent only",
		"mainAgentOnlyHint": "Subagent completions and progress stay silent; approvals and questions are still delivered"
	},
	"events": {
		"section": "Triggers",
		"hint": "Choose which events send a push.",
		"conversationCompleted": "Conversation completed",
		"conversationPaused": "Conversation paused",
		"conversationFailed": "Conversation failed",
		"authorizationRequired": "Approval required",
		"confirmationRequired": "Question waiting",
		"todoProgress": "Task progress"
	},
	"channels": {
		"section": "Channels",
		"hint": "Enable at least one channel and fill in its credentials."
	},
	"wechat": {
		"title": "WeChat",
		"enabled": "Enable the WeChat bot",
		"interactive": "Accept replies in WeChat",
		"interactiveHint": "When off, pushes are sent but replies are ignored",
		"defaultTargets": "Default recipients",
		"defaultTargetsHint": "Leave empty to reach whoever messaged the bot most recently",
		"login": "Scan to log in",
		"relogin": "Log in again",
		"logout": "Log out",
		"scanHint": "Scan the QR code with WeChat. Send the bot one message after logging in so pushes can reach you.",
		"targets": "Known recipients",
		"noTargets": "Nobody has messaged the bot yet",
		"bind": "Scan to bind",
		"loginStarted": "Login started; the QR code appears shortly",
		"disabledHint": "Disabled (binding turns it on and starts the scan)"
	},
	"wecomAibot": {
		"title": "WeCom AI bot",
		"enabled": "Enable the AI bot",
		"interactive": "Accept replies in WeCom",
		"interactiveHint": "When off, pushes are sent but replies are ignored",
		"botId": "Bot ID",
		"secret": "Secret",
		"defaultTargets": "Default chats",
		"defaultTargetsHint": "A userid for direct chat or a chatid for groups; empty reaches recent chats",
		"qrStart": "Scan to associate",
		"qrHint": "Scan with WeCom to fill in the Bot ID and Secret",
		"status": "Connection",
		"qrExpired": "The QR code expired; start again",
		"qrTimeout": "Association timed out; try again",
		"qrFailed": "Association failed",
		"qrDone": "Associated; Bot ID and Secret were filled in",
		"qrRelink": "Relink",
		"qrStarted": "Association started; the QR code appears shortly"
	},
	"wecomWebhook": {
		"title": "WeCom group bot",
		"enabled": "Enable the group bot",
		"webhookUrl": "Webhook URL",
		"webhookUrlHint": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…",
		"mentions": "Mentions",
		"mentionsHint": "userid or @all, comma separated; text messages only",
		"msgType": "Message type"
	},
	"defaultChannel": {
		"title": "Default channel",
		"hint": "Proactive pushes without a channel go here only; when it is unavailable the push fails instead of moving to another channel.",
		"auto": "Automatic (first enabled, fully configured channel)"
	},
	"push": {
		"section": "Proactive push",
		"replyTimeout": "Reply timeout (ms)",
		"replyTimeoutHint": "Longest wait when push_message asks for a reply; 300000 maximum"
	},
	"messages": {
		"section": "Chat wording",
		"locale": "Chat language",
		"localeHint": "Language of messages sent to chat, independent of this page",
		"hint": "Reply hint",
		"hintHint": "Append a line telling the reader that replying continues the conversation"
	},
	"state": {
		"ready": "Connected",
		"opening": "Connecting",
		"degraded": "Degraded",
		"error": "Error",
		"closed": "Stopped",
		"disabled": "Disabled"
	},
	"common": {
		"cancel": "Cancel",
		"retry": "Retry",
		"none": "None",
		"unknown": "Unknown error"
	},
	"language": {
		"zh": "中文",
		"en": "English"
	},
	"channel": {
		"test": "Send test",
		"testOk": "Test message sent",
		"testFailed": "Test failed",
		"noTargetHint": "No known chat yet: message the bot once",
		"knownChats": "Known chats"
	},
	"tabs": {
		"general": "General",
		"wechat": "WeChat",
		"wecomAibot": "WeCom",
		"wecomWebhook": "Group bot",
		"system": "System"
	},
	"deliveries": {
		"title": "Recent deliveries",
		"hint": "One row per outbound attempt: time · channel/target · result. This is how you tell whether a message actually left.",
		"ok": "ok",
		"failed": "failed",
		"empty": "No deliveries recorded yet."
	},
	"system": {
		"title": "System notifications",
		"enabled": "Enable system notifications",
		"enabledHint": "Session events raise an OS notification (macOS / Linux / Windows) instead of going through WeChat or WeCom.",
		"sound": "Play a cue",
		"soundHint": "Play a short cue with each notification (synthesized by the page, not the OS; silent while this page is closed)",
		"events": "Events that raise a system notification",
		"eventsHint": "Independent of the event switches under General: this only decides which events also pop an OS notification.",
		"permission": "Permission",
		"permissionGranted": "Granted",
		"permissionDefault": "Not requested",
		"permissionDenied": "Denied",
		"permissionUnsupported": "This page has no Notification API",
		"requestPermission": "Request permission",
		"testNotification": "Send test",
		"testSent": "Sent",
		"testTitle": "🧪 DSH notification test",
		"testBody": "From the DSH push center; seeing this means notifications work.",
		"guidanceBrowser": "If nothing appeared, check two places: allow notifications for this site in the browser's address-bar controls, and allow that browser in the OS (macOS: System Settings → Notifications → your browser; Windows: Settings → System → Notifications)."
	}
};
// src/client/index.ts
/** Browser half: registers the Push settings section. */
const NS = "push-center";
/** Flatten a nested dictionary into the dotted keys the locale service resolves. */
function flatten(source, prefix = "") {
	const out = {};
	for (const [key, value] of Object.entries(source)) {
		const path = prefix.length === 0 ? key : prefix + "." + key;
		if (typeof value === "string") out[path] = value;
		else if (value !== null && typeof value === "object") Object.assign(out, flatten(value, path));
	}
	return out;
}
/** Sidebar bell. */
function NavIcon({ size = 16 }) {
	return (0, react.createElement)("svg", {
		width: size,
		height: size,
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": true
	}, (0, react.createElement)("path", {
		d: "M12 4.3v1.2M6.6 11.4a5.4 5.4 0 0 1 10.8 0V15l1.2 2.1a.9.9 0 0 1-.8 1.4H5.9a.9.9 0 0 1-.8-1.4L6.6 15v-3.6M9.6 19a2.4 2.4 0 0 0 4.8 0",
		stroke: "currentColor",
		strokeWidth: 1.6,
		strokeLinecap: "round",
		strokeLinejoin: "round"
	}));
}
const name = "push-center";
const inject = [
	"slots",
	"connection",
	"locale"
];
/** Mount the settings page. */
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, {
		zh: flatten(ui$1),
		en: flatten(ui)
	}), "push-center: dictionaries");
	const t = ctx.locale.bind(NS);
	const rpcCall = async (channel, endpoint, payload) => {
		try {
			const result = await ctx.connection.rpc.call(channel, endpoint, payload);
			return {
				ok: result?.ok === true,
				...result?.value === void 0 ? {} : { value: result.value },
				...result?.error === void 0 ? {} : { error: result.error }
			};
		} catch (error) {
			return {
				ok: false,
				error: { message: error instanceof Error ? error.message : String(error) }
			};
		}
	};
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "push",
		order: 60,
		label: () => t("nav"),
		locale: NS,
		inject: () => ({
			rpcCall,
			channel: RPC_CHANNEL,
			endpoints: RPC_ENDPOINTS
		})
	}, SettingsPage));
	ctx.effect(() => startSystemNotifications({ call: rpcCall }), "push-center: system notifications");
	ctx.slots.inject("settings.section.icon", () => ctx.slots.register({
		name: "settings.section.icon",
		id: "push",
		order: 60
	}, NavIcon));
}
exports.apply = apply;
exports.inject = inject;
exports.name = name;

//# sourceMappingURL=client.cjs.map
return module.exports;
} });
