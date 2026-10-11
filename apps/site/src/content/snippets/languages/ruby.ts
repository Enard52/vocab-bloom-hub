import { rubyLiteral } from '../literals';
import type { SnippetLanguageT } from '../types';

/** Standard-library HTTP and JSON, with TLS enabled for HTTPS URLs. */
export const ruby: SnippetLanguageT = {
  id: 'ruby',
  label: 'Ruby',
  highlight: 'ruby',
  render: ({ method, url, body }) => {
    if (method !== 'GET' && method !== 'POST') return null;
    return [
      "require 'net/http'",
      "require 'json'",
      '',
      `uri = URI(${rubyLiteral(url)})`,
      `request = Net::HTTP::${method === 'POST' ? 'Post' : 'Get'}.new(uri)`,
      ...(body !== null
        ? ["request['Content-Type'] = 'application/json'", `request.body = JSON.generate(${rubyLiteral(body)})`]
        : []),
      "response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|",
      '  http.request(request)',
      'end',
      'response.value',
      'answer = JSON.parse(response.body)',
      'puts JSON.pretty_generate(answer)',
    ].join('\n');
  },
};
