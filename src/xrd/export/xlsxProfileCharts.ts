type XlsxModule = typeof import('xlsx');

type ArchiveEntry = {
  content?: Uint8Array;
};

type Archive = {
  FullPaths: string[];
  FileIndex: ArchiveEntry[];
};

type ProfileChart = Readonly<{
  title: string;
  valueColumn: string;
  color: string;
}>;

const PROFILE_CHARTS: readonly ProfileChart[] = [
  { title: 'Smectite + I/S, %', valueColumn: 'C', color: '008C87' },
  { title: 'Illite, %', valueColumn: 'D', color: '2878B5' },
  { title: 'Chlorite, %', valueColumn: 'E', color: '3A923A' },
  { title: 'Kaolinite, %', valueColumn: 'F', color: 'E58B19' },
];

function xmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function archivePath(archive: Archive, path: string): string {
  return `${archive.FullPaths[0]}${path}`;
}

function readArchiveText(archive: Archive, path: string): string {
  const fullPath = archivePath(archive, path);
  const index = archive.FullPaths.indexOf(fullPath);
  const content = index >= 0 ? archive.FileIndex[index]?.content : undefined;
  if (!content) throw new Error(`XLSX part not found: ${path}`);
  return new TextDecoder().decode(content);
}

function writeArchiveText(XLSX: XlsxModule, archive: Archive, path: string, content: string): void {
  XLSX.CFB.utils.cfb_add(archive, path, new TextEncoder().encode(content));
}

function chartTitle(title: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1500" b="1"/></a:pPr><a:r><a:rPr lang="ru-RU" sz="1500" b="1"/><a:t>${xmlText(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`;
}

function axisTitle(title: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"/></a:pPr><a:r><a:rPr lang="ru-RU" sz="1000"/><a:t>${xmlText(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`;
}

function buildChartXml(chart: ProfileChart, index: number, sampleCount: number): string {
  const firstRow = 2;
  const lastRow = sampleCount + 1;
  const xAxisId = 100_000 + index * 2;
  const yAxisId = xAxisId + 1;
  const titleReference = `'Biscaye'!$${chart.valueColumn}$1`;
  const valueReference = `'Biscaye'!$${chart.valueColumn}$${firstRow}:$${chart.valueColumn}$${lastRow}`;
  const orderReference = `'Biscaye'!$A$${firstRow}:$A$${lastRow}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/><c:lang val="ru-RU"/><c:roundedCorners val="0"/>
  <c:chart>
    ${chartTitle(chart.title)}
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:scatterChart>
        <c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>${titleReference}</c:f></c:strRef></c:tx>
          <c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${chart.color}"/></a:solidFill><a:prstDash val="solid"/></a:ln></c:spPr>
          <c:marker><c:symbol val="square"/><c:size val="6"/><c:spPr><a:solidFill><a:srgbClr val="${chart.color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${chart.color}"/></a:solidFill></a:ln></c:spPr></c:marker>
          <c:xVal><c:numRef><c:f>${valueReference}</c:f></c:numRef></c:xVal>
          <c:yVal><c:numRef><c:f>${orderReference}</c:f></c:numRef></c:yVal>
          <c:smooth val="0"/>
        </c:ser>
        <c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls>
        <c:axId val="${xAxisId}"/><c:axId val="${yAxisId}"/>
      </c:scatterChart>
      <c:valAx>
        <c:axId val="${xAxisId}"/><c:scaling><c:orientation val="minMax"/><c:max val="100"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>
        <c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E6E9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        ${axisTitle('Содержание, %')}
        <c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>
        <c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:ln></c:spPr>
        <c:crossAx val="${yAxisId}"/><c:crosses val="max"/><c:majorUnit val="20"/>
      </c:valAx>
      <c:valAx>
        <c:axId val="${yAxisId}"/><c:scaling><c:orientation val="maxMin"/><c:max val="${sampleCount + 0.5}"/><c:min val="0.5"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>
        ${axisTitle('Образец, №')}
        <c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>
        <c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:ln></c:spPr>
        <c:crossAx val="${xAxisId}"/><c:crosses val="autoZero"/><c:majorUnit val="1"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/><c:delete val="1"/></c:legend>
    <c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/>
  </c:chart>
  <c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>
</c:chartSpace>`;
}

function buildDrawingXml(sampleCount: number): string {
  const chartHeight = Math.max(30, Math.min(70, sampleCount * 3 + 12));
  const anchors = PROFILE_CHARTS.map((_, index) => {
    const column = index % 2 === 0 ? 0 : 8;
    const row = index < 2 ? 1 : chartHeight + 3;
    return `<xdr:twoCellAnchor editAs="oneCell">
      <xdr:from><xdr:col>${column}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${column + 7}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + chartHeight}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${index + 2}" name="Профиль ${index + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm/>
        <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${index + 1}"/></a:graphicData></a:graphic>
      </xdr:graphicFrame><xdr:clientData/>
    </xdr:twoCellAnchor>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

function buildDrawingRelationships(): string {
  const relationships = PROFILE_CHARTS.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${index + 1}.xml"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

export function addMineralProfileCharts(XLSX: XlsxModule, workbookData: ArrayBuffer, sampleCount: number): ArrayBuffer {
  const archive = XLSX.CFB.read(new Uint8Array(workbookData), { type: 'buffer' }) as Archive;
  const sheetPath = 'xl/worksheets/sheet2.xml';
  const sheetXml = readArchiveText(archive, sheetPath);
  const drawingTag = '<drawing r:id="rId1"/>';
  const sheetWithDrawing = sheetXml.includes('<ignoredErrors>')
    ? sheetXml.replace('<ignoredErrors>', `${drawingTag}<ignoredErrors>`)
    : sheetXml.replace('</worksheet>', `${drawingTag}</worksheet>`);
  writeArchiveText(XLSX, archive, sheetPath, sheetWithDrawing);
  writeArchiveText(XLSX, archive, 'xl/worksheets/_rels/sheet2.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
  writeArchiveText(XLSX, archive, 'xl/drawings/drawing1.xml', buildDrawingXml(sampleCount));
  writeArchiveText(XLSX, archive, 'xl/drawings/_rels/drawing1.xml.rels', buildDrawingRelationships());
  PROFILE_CHARTS.forEach((chart, index) => writeArchiveText(XLSX, archive, `xl/charts/chart${index + 1}.xml`, buildChartXml(chart, index, sampleCount)));

  const contentTypesPath = '[Content_Types].xml';
  const contentTypes = readArchiveText(archive, contentTypesPath);
  const chartOverrides = PROFILE_CHARTS.map((_, index) => `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('');
  const drawingOverride = '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
  writeArchiveText(XLSX, archive, contentTypesPath, contentTypes.replace('</Types>', `${drawingOverride}${chartOverrides}</Types>`));

  const output = XLSX.CFB.write(archive, { type: 'array', fileType: 'zip', compression: true }) as Uint8Array;
  return new Uint8Array(output).buffer;
}
