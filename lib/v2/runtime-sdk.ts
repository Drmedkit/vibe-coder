export const RUNTIME_SDK_SOURCE = String.raw`
(function () {
  'use strict';
  var meta = document.querySelector('meta[name="vibe-deployment"]');
  var deployment = meta ? meta.getAttribute('content') : '';

  async function request(path, options) {
    var response = await fetch('/api/runtime' + path, Object.assign({}, options || {}, {
      credentials: 'omit',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'X-Vibe-Deployment': deployment || ''
      }, options && options.headers ? options.headers : {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || 'The creation could not reach Vibe services.');
    return body;
  }

  window.vibe = Object.freeze({
    project: Object.freeze({
      info: function () { return request('/project', { method: 'GET' }); }
    }),
    data: Object.freeze({
      list: function (collection) {
        return request('/data/' + encodeURIComponent(collection), { method: 'GET' });
      },
      create: function (collection, record) {
        return request('/data/' + encodeURIComponent(collection), {
          method: 'POST', body: JSON.stringify(record || {})
        });
      },
      update: function (collection, id, patch) {
        return request('/data/' + encodeURIComponent(collection) + '/' + encodeURIComponent(id), {
          method: 'PATCH', body: JSON.stringify(patch || {})
        });
      },
      increment: function (collection, id, field, amount) {
        return request('/data/' + encodeURIComponent(collection) + '/' + encodeURIComponent(id) + '/increment', {
          method: 'POST', body: JSON.stringify({ field: field, amount: amount || 1 })
        });
      }
    }),
    ai: Object.freeze({
      text: function (prompt) {
        return request('/ai/text', { method: 'POST', body: JSON.stringify({ prompt: prompt }) });
      },
      image: function (prompt) {
        return request('/ai/image', { method: 'POST', body: JSON.stringify({ prompt: prompt }) });
      }
    })
  });
})();
`
