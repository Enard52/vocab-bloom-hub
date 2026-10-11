import { jsonLine, rustRawString } from '../literals';
import type { SnippetLanguageT } from '../types';

/** A standalone blocking reqwest program; Value supports both object and array responses. */
export const rust: SnippetLanguageT = {
  id: 'rust',
  label: 'Rust',
  highlight: 'rust',
  render: ({ method, url, body }) => {
    if (method !== 'GET' && method !== 'POST') return null;
    return [
      '// cargo add reqwest --features blocking,json',
      '// cargo add serde_json',
      'use reqwest::blocking::Client;',
      'use serde_json::Value;',
      '',
      'fn main() -> Result<(), Box<dyn std::error::Error>> {',
      '    let client = Client::new();',
      ...(body !== null
        ? [`    let body: Value = serde_json::from_str(${rustRawString(jsonLine(body))})?;`]
        : []),
      '    let answer: Value = client',
      `        .${method.toLowerCase()}(${rustRawString(url)})`,
      ...(body !== null ? ['        .json(&body)'] : []),
      '        .send()?',
      '        .error_for_status()?',
      '        .json()?;',
      '    println!("{answer}");',
      '    Ok(())',
      '}',
    ].join('\n');
  },
};
