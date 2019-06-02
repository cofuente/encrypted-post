import $ from 'jquery';

import JSEncrypt from 'jsencrypt';
import privKey from 'PRIVATE_KEY_FILE';

require('datatables.net');

const decrypt = new JSEncrypt();
decrypt.setPrivateKey(privKey);

function decryptRow(row) {
  let decryptedStringifiedView = null
  try {
     decryptedStringifiedView = JSON.parse(decrypt.decrypt(atob(row[0])));
  } catch(err) {
    decryptedStringifiedView = null
  }
  if (decryptedStringifiedView) {
    const view = decryptedStringifiedView.map(str => parseInt(str, 10));
    const keyBuff = new Uint8Array(view);
    const fetchKey = crypto.subtle.importKey('raw', keyBuff, 'AES-GCM', false, ['decrypt']);
    const dataString = atob(row[1]);
    const dataBuffer = new Uint8Array(dataString.length);
    for (let i = 0; i < dataString.length; i += 1) {
      dataBuffer[i] = dataString.charCodeAt(i);
    }
    const iv = atob(row[2]).split(',').map(str => parseInt(str, 10));
    const ivBuffer = new Uint32Array(iv);
    return fetchKey.then(
      key => crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
        },
        key,
        dataBuffer).then((payload) => {
          const decoder = new TextDecoder();
          console.log('decrypted', JSON.parse(decoder.decode(payload)))
          return JSON.parse(decoder.decode(payload));
        }).catch((err) => {
          console.log(err);
        }));
  } else {
    return Promise.resolve({})
  }
}
window.decryptOneRow = function(row) {
  decryptFormResponses([row]).then(displayResponses);
}

function decryptFormResponses(rows) {
  return Promise.all(rows.map(decryptRow));
}

function displayResponses(rows) {
  const renameMap = {}
  const columns = Object.keys(rows.reduce((keys, row) => {
    Object.keys(row).forEach((key) => {
      if (!keys[key]) {
        // DataTable goes nuts with '.' in key
        const finalKey = key.replace(/\.|\,|\n/g, '_')
        /* eslint-disable no-param-reassign */
        if (/\.|\,|\n/.test(key)) {
          renameMap[key] = finalKey
        }
        keys[finalKey] = true;
        /* eslint-enable no-param-reassign */
      }
    });
    return keys;
  }, {}));
  let outputRows = rows.filter(x => Object.keys(x).length > 0).map(row => {
    Object.keys(renameMap).forEach(key => {
      if (row[key]) {
        row[renameMap[key]] = row[key]
        delete row[key]
      }
    })
    return row
  });
  $('#results').DataTable({
    data: outputRows,
    columns: columns.map(key => ({ data: key, title: key }))
  });
  const isPrivateData = (col) => {
    return /name|zip|birth|address|phone|mobile/i.test(col)
  }
  const anonColumns = columns.filter(c => !isPrivateData(c))

  function generateCsvContent(columns) {
    var csvContent = "data:text/csv;charset=utf-8,";
    csvContent = csvContent + columns.join(',') + '\n'
    csvContent = csvContent + outputRows.map(
      row =>
        columns.map(col => (row[col] && row[col].replace(/,/g, ';')) || '').join(',')
    ).join('\n')
    return csvContent
  }
  $('#csvanonymous').attr({href: generateCsvContent(anonColumns),
                           download: 'AnonymizedData.csv'})
  $('#csvprivate').attr({href: generateCsvContent(columns),
                           download: 'PrivateData.csv'})
  //open.window(encodeURI(window.csvContent))
  // submit at, handle, state, zip, enrollment code
  return rows;
}

$(document).ready(() => {
  const upload = document.getElementById('encrypted');
  if (upload) {
    upload.addEventListener('change', (e) => {
      const reader = new FileReader();
      reader.onload = () => {
        const rows = reader.result.split('\n').map(row => row.split(','));
        //rows.shift(); only if header row -- let's fix this in decryption
        decryptFormResponses(rows).then(displayResponses);
      };
      reader.readAsBinaryString(e.target.files[0]);
    });
  }
});
