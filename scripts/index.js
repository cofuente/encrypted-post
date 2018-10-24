function encryptFormResponse(res) {
  var crypto = window.crypto || window.msCrypto;
  var initVector = window.crypto.getRandomValues(new Uint32Array(8));
  var jsEncrypt = new JSEncrypt;
  var pubKey = '-----BEGIN PUBLIC KEY-----' +
      'MIIBIzANBgkqhkiG9w0BAQEFAAOCARAAMIIBCwKCAQIAvGIrYJvw1wXHi29KOay4' +
      'r8pz1+bQQz3T8EhlprtI/7TcclzrVpKfAlFkzSg+sR1IIP/4g/rmcbRmT7S1QS3A' +
      '3vtol1sx7NcSuNd4iE2SbnLiD3ZSlQwk3CwThwS4clVC2uyHyUzR70G8q+GUH+rG' +
      'hRUbdQd/CkGFSm3sm1GB8prY/y1VanTw+B3b+sThDA9QuiQAY7RpJkeUgxqTlinH' +
      'sJVIVZO0RRf/vsb+YnU4yfCxLsnuIlAf+n36IQ9UzkyzGu2EqfwArRr4YfkZAUYX' +
      'kAV8A3d9QMqoEpOBe/K2NirXCfpBBYAcWEm3BHzf2cSi6whIMCgzwPlA89zaXuYK' +
      '1a0CAwEAAQ==' +
      '-----END PUBLIC KEY-----';
  jsEncrypt.setPublicKey(pubKey);
  // https://www.w3.org/2012/webcrypto/draft-irtf-cfrg-webcrypto-algorithms-00#sctn-intro
  // https://github.com/diafygi/webcrypto-examples
  var genKey = crypto.subtle.generateKey({
          name: "AES-GCM",
          length: 256
      },
      true,
      ["encrypt", "decrypt"]
  );
  var genCipher = genKey.then(function(key) {
      var encoder = new TextEncoder;
      var buffer = encoder.encode(JSON.stringify(res)).buffer;
      return crypto.subtle.encrypt({
              name: "AES-GCM",
              iv: initVector
          },
          key,
          buffer
      );
  }).then(function(cipherTextBuffer) {
      var typedBuffer = new Uint8Array(cipherTextBuffer);
      var binary = '';
      for (var i = 0; i < typedBuffer.byteLength; i++) {
          binary += String.fromCharCode(typedBuffer[i]);
      }
      return btoa(binary);
  });
  var genEncryptedKey = genKey.then(function(key) {
      return crypto.subtle.exportKey("raw", key);
  }).then(function(serializedKey) {
      var view = new Uint8Array(serializedKey)
      var stringifiedView = [];
      view.forEach(function (point) {
         stringifiedView.push(point.toString());
      });
      return btoa(jsEncrypt.encrypt(JSON.stringify(stringifiedView)));
  });
  return Promise.all([genEncryptedKey, genCipher, Promise.resolve(initVector)]);
}

function sendFormResponse([encryptedKey, cipherText, initVector]) {
  // DEBUG URL
  var url = 'https://script.google.com/macros/s/AKfycby_k7iy8n9o2KQWLxrYC6VrRPYw6ssfi-ttx1nmnDw6GxZY9dVv/exec';
  //   var url = 'https://script.google.com/macros/s/AKfycbwe7OLOLtxAN_smlnNFyQWDqbjVVk9Vq76QwA0Cj8yiX4_SDS7Z/exec';
  $.ajax(url, {
          dataType: 'jsonp',
          data: {
              key: encryptedKey,
              fielddata: cipherText,
              initVector: btoa(initVector.toString())
          },
      })
      .fail(function(err) {
          console.error(arguments);
      });
}

$(document).ready(function () {
    var frm = document.forms['customer'];
    function clearForm() {
      if (window.confirm('Your request has been received. Do you want to clear local data?')) {
          frm.reset();
      }
    }
    function isSet(ele) {
        if (!ele.name) {
            return false;
        }
        if (ele.type === 'radio' || ele.type === 'checkbox') {
            return ele.checked;
        }
        return ele.value !== '';
    }
    function setValue(ele, res) {
        if (ele.type === 'checkbox') {
            var category = $(ele).closest('fieldset').attr('id');
            if (res[category]) {
                res[category].push(ele.value)
            } else {
                res[category] = [ele.value]
            }
        } else {
            res[ele.name] = ele.value;
        }
    }
    frm.onsubmit = function() {
        var res = {};
        Array.from(frm.elements).forEach(function (ele) {
          if (ele && isSet(ele)) {
              setValue(ele, res);
          }
        });
        encryptFormResponse(res).then(sendFormResponse).then(clearForm);
    }
});
