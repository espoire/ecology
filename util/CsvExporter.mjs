import fs from 'node:fs';

export default class CsvExporter {
  /**
   * @param {*[][]} data
   * @param {string} filename
   */
  static write(data, filename = 'out.csv') {
    if (!filename.startsWith('./out/')) filename = `./out/${filename}`;
    if (!filename.endsWith('.csv')) filename += '.csv';

    const content = data.map(row => row.join(',')).join('\n');

    fs.writeFileSync(filename, content, err => {
      if (err) console.error(`CsvExporter.write:: Error writing to file '${filename}':`, err);
    });
  }
}