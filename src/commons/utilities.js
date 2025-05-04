var COMPARATION_OPERATORS = require("./../commons/comparationOperators");
const RECURRENCE_TYPES = require("./../commons/recurrenceTypes");
const moment = require('moment-timezone');

class Utilities {

  static transformFechaEmision(fechaEmisionRaw) {
    // Extraer partes de la fecha y hora
    const year = fechaEmisionRaw.substring(0, 4);
    const month = fechaEmisionRaw.substring(4, 6);
    const day = fechaEmisionRaw.substring(6, 8);
    const hour = fechaEmisionRaw.substring(8, 10);
    const minute = fechaEmisionRaw.substring(10, 12);
    const second = fechaEmisionRaw.substring(12, 14);
    const milliseconds = fechaEmisionRaw.substring(14, 17); // Últimos 3 dígitos

    // Formatear la fecha y la hora
    const fechaEmision = `${year}-${month}-${day}`;
    const horaEmision = `${hour}:${minute}:${second}.${milliseconds}`;

    return { fechaEmision, horaEmision };
  }

  static splitStringByMaxSize(inputString, maxSize) {
    const chunks = [];
    let index = 0;

    while (index < inputString.length) {
      let chunk = inputString.substr(index, maxSize);

      // Check if the chunk ends in the middle of a word
      if (chunk.length === maxSize && inputString[index + maxSize] !== ' ' && inputString[index + maxSize] !== undefined) {
        // Find the last space within the chunk
        const lastSpaceIndex = chunk.lastIndexOf(' ');
        if (lastSpaceIndex !== -1) {
          // Adjust the chunk to end at the last space
          chunk = chunk.substr(0, lastSpaceIndex);
          index += lastSpaceIndex + 1; // Skip the space
        }
      } else {
        index += maxSize;
      }

      chunks.push(chunk.trim());
    }

    return chunks;
  }

  static convertToNumberIfNeeded(value) {
    // Check if the value is a string
    if (typeof value === 'string') {
      // Try to convert the string to a number
      const numberValue = Number(value);
      // Check if the conversion was successful
      if (!isNaN(numberValue)) {
        // If successful, return the number
        return numberValue;
      } else {
        // If conversion failed, return NaN or handle the error as needed
        return NaN;
      }
    } else if (typeof value === 'number') {
      // If the value is already a number, just return it
      return value;
    } else {
      // If the value is neither a string nor a number, return NaN or handle the error as needed
      return NaN;
    }
  }

  static getRandomNumber(min, max) {
    // Make sure min and max are valid numbers
    if (typeof min !== 'number' || typeof max !== 'number') {
      throw new Error('Both arguments must be numbers');
    }

    // Ensure min is less than max
    if (min >= max) {
      throw new Error('The first argument must be less than the second argument');
    }

    // Calculate the random number
    const randomNumber = Math.random() * (max - min) + min;

    // Return the result
    return Math.floor(randomNumber);
  }

  static getBolivianInvoiceDateFormat(date = undefined) {
    return moment(date).tz("America/La_Paz").format('YYYY-MM-DDTHH:mm:ss.SSS');
  }

  static getFrecuencyDaysByDate(firstDate, lastDate) {
    return moment(lastDate).dayOfYear() - moment(firstDate).dayOfYear();
  }

  static getUnitMomentDateByRecurrence(recurrenceType) {
    var result = 'months';
    switch (recurrenceType) {
      case RECURRENCE_TYPES.annually.code:
        result = 'years'
        break;
      case RECURRENCE_TYPES.monthly.code:
        result = 'months';
        break;
      case RECURRENCE_TYPES.weekly.code:
        result = 'weeks'
        break;
      case RECURRENCE_TYPES.daily.code:
        result = 'days';
        break;
      case RECURRENCE_TYPES.midnight.code:
        result = 'days';
        break;
      case RECURRENCE_TYPES.hourly.code:
        result = 'hours';
        break;

      default:
        break;
    }

    return result;
  }

  static convertToFloat1(value) {
    var result = 0;

    var result = 0;

    if (value) {
      if (value.toFixed) {
        result = parseFloat(value.toFixed(2));
      } else {
        result = parseFloat(parseFloat(value).toFixed(2));
      }
    }

    return result;
  }

  static convertToFloat2(value, size) {
    var result = 0;

    if (value) {
      if (value.toFixed) {
        result = parseFloat(value.toFixed(size || 2));
      } else {
        result = parseFloat(parseFloat(value).toFixed(size || 2));
      }
    }

    return result;
  }

  static copyObject(object) {
    return JSON.parse(JSON.stringify(object));
  }

  static prepareStringFilter(stringFilter) {
    var filter = "";

    if (stringFilter && stringFilter.operator && stringFilter.field && (stringFilter.value === false || stringFilter.value === 0 || stringFilter.value)) {
      var stringValue = stringFilter.value == true || stringFilter.value == false ? stringFilter.value : `"${stringFilter.value}"`
      switch (stringFilter.operator) {
        case COMPARATION_OPERATORS.EQUAL.value:
          filter = `"${stringFilter.field}": ${stringValue}`
          break;
        case COMPARATION_OPERATORS.NO_EQUAL.value:
          filter = `"${stringFilter.field}": { "$ne": "${stringFilter.value}" }`
          break;
        case COMPARATION_OPERATORS.CONTAINS.value:
          filter = `"${stringFilter.field}": { "$regex": ".*${stringFilter.value}.*", "$options": "i" }`
          break;
        case COMPARATION_OPERATORS.NO_CONTAINS.value:
          filter = `"${stringFilter.field}": { "$not": { "$regex": ".*${stringFilter.value}.*", "$options": "i" }}`
          break;
        default:
          filter = `"${stringFilter.field}": "${stringFilter.value}"`
          break;
      }
    }
    return filter;
  }

  static prepareStringFilters(stringFilters) {
    var filter = '';

    if (stringFilters) {
      var validStringFilters = [];
      stringFilters.forEach(stringFilter => {
        if (stringFilter.value) {
          validStringFilters.push(stringFilter);
        } else if (stringFilter.value === false || stringFilter.value === 0) {
          validStringFilters.push(stringFilter);
        }
      })
      if (validStringFilters.length > 1) {
        filter = Utilities.prepareStaticFilters(validStringFilters);
      } else {
        filter = Utilities.prepareStringFilter(validStringFilters[0]);
      }
    }

    return filter;
  }

  static prepareFilter(dateFilter, stringFilters, staticFilters) {
    var filter = "";

    if (dateFilter && dateFilter.field && dateFilter.startDate && dateFilter.stopDate) {
      filter = `"${dateFilter.field}": {"$gte": "${dateFilter.startDate}","$lt": "${dateFilter.stopDate}"}`;
    }
    if (stringFilters) {
      if (staticFilters) {
        stringFilters.push(...staticFilters)
      }
    } else {
      stringFilters = staticFilters;
    }
    var currentStringFilter = Utilities.prepareStringFilters(stringFilters);

    filter = filter ? (currentStringFilter ? `${filter}, ${currentStringFilter}` : filter) : currentStringFilter;

    return filter;
  }

  static prepareDateFilter(dateFilter) {
    var filter = "";

    if (dateFilter && dateFilter.field && dateFilter.startDate && dateFilter.stopDate) {
      filter = `"${dateFilter.field}": {"$gte": "${dateFilter.startDate}","$lt": "${dateFilter.stopDate}"}`;
    }

    return filter;
  }

  static prepareStaticFilters(staticFilters) {
    var filterResponse = '';

    if (staticFilters) {
      filterResponse = '"$and": ['
      staticFilters.forEach((staticFilter, i) => {
        if (i == 0) {
          filterResponse += `{${Utilities.prepareStringFilter(staticFilter)}}`;
        } else {
          filterResponse += `, {${Utilities.prepareStringFilter(staticFilter)}}`;
        }
      });
      filterResponse += ']'
    }

    return filterResponse;
  }

  static removeFromArray(array, element) {
    const index = array.indexOf(element);
    array.splice(index, 1);
  }

  static arraysEqual(array1, array2) {
    const temp = new Array();
    if (!array1[0] || !array2[0]) {
      // If either is not an array
      return false;
    }
    if (array1.length !== array2.length) {
      return false;
    }
    // Put all the elements from array1 into a "tagged" array
    for (let i = 0; i < array1.length; i++) {
      const key = typeof array1[i] + "~" + array1[i];
      // Use "typeof" so a number 1 isn't equal to a string "1".
      if (temp[key]) {
        temp[key]++;
      } else {
        temp[key] = 1;
      }
      // temp[key] = # of occurrences of the value (so an element could appear multiple times)
    }
    // Go through array2 - if same tag missing in "tagged" array, not equal
    for (let i = 0; i < array2.length; i++) {
      const key = typeof array2[i] + "~" + array2[i];
      if (temp[key]) {
        if (temp[key] == 0) {
          return false;
        } else {
          temp[key]--;
        }
        // Subtract to keep track of # of appearances in array2
      } else {
        // Key didn't appear in array1, arrays are not equal.
        return false;
      }
    }
    // If we get to this point, then every generated key in array1 showed up the exact same
    // number of times in array2, so the arrays are equal.
    return true;
  }

  static arrayIsEqual(value, other) {
    // Get the value type
    const type = Object.prototype.toString.call(value);

    // If the two objects are not the same type, return false
    if (type !== Object.prototype.toString.call(other)) {
      return false;
    }

    // If items are not an object or array, return false
    if (['[object Array]', '[object Object]'].indexOf(type) < 0) {
      return false;
    }

    // Compare the length of the length of the two items
    const valueLen =
      type === '[object Array]' ? value.length : Object.keys(value).length;
    const otherLen =
      type === '[object Array]' ? other.length : Object.keys(other).length;
    if (valueLen !== otherLen) {
      return false;
    }

    // Compare two items
    const compare = function (item1, item2) {
      // Get the object type
      const itemType = Object.prototype.toString.call(item1);

      // If an object or array, compare recursively
      if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
        if (!Utilities.arrayIsEqual(item1, item2)) {
          return false;
        }
      } else {
        // If the two items are not the same type, return false
        if (itemType !== Object.prototype.toString.call(item2)) {
          return false;
        }

        // Else if it's a function, convert to a string and compare
        // Otherwise, just compare
        if (itemType === '[object Function]') {
          if (item1.toString() !== item2.toString()) {
            return false;
          }
        } else {
          if (item1 !== item2) {
            return false;
          }
        }
      }
    };

    // Compare properties
    if (type === '[object Array]') {
      for (let i = 0; i < valueLen; i++) {
        if (compare(value[i], other[i]) === false) {
          return false;
        }
      }
    } else {
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          if (compare(value[key], other[key]) === false) {
            return false;
          }
        }
      }
    }

    // If nothing failed, return true
    return true;
  }
}

module.exports = Utilities;
