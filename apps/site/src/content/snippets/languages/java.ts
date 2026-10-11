import { jsonLine } from '../literals';
import type { SnippetLanguageT } from '../types';

/** A complete Java 11+ program, using only the standard HTTP client. */
export const java: SnippetLanguageT = {
  id: 'java',
  label: 'Java',
  highlight: 'java',
  render: ({ method, url, body }) => {
    if (method !== 'GET' && method !== 'POST') return null;
    return [
      'import java.net.URI;',
      'import java.net.http.HttpClient;',
      'import java.net.http.HttpRequest;',
      'import java.net.http.HttpResponse;',
      '',
      'public class Main {',
      '    public static void main(String[] args) throws Exception {',
      '        HttpClient client = HttpClient.newHttpClient();',
      '        HttpRequest request = HttpRequest.newBuilder()',
      `            .uri(URI.create(${jsonLine(url)}))`,
      ...(method === 'POST'
        ? [
            '            .header("Content-Type", "application/json")',
            `            .POST(HttpRequest.BodyPublishers.ofString(${jsonLine(jsonLine(body))}))`,
          ]
        : ['            .GET()']),
      '            .build();',
      '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
      '        System.out.println(response.body());',
      '    }',
      '}',
    ].join('\n');
  },
};
