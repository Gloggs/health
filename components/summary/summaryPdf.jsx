// The GP summary as a PDF (react-pdf), built from the same object as the screen. Loaded only when someone
// presses Download, so it adds nothing to the normal page. Helvetica is used because PDFs embed fonts
// differently from the web; the wording and order are identical to the screen.
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const st = StyleSheet.create({
  page: { padding: 40, fontSize: 10.5, lineHeight: 1.45, color: "#142019", fontFamily: "Helvetica" },
  h1: { fontSize: 18, lineHeight: 1.25, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  meta: { color: "#5A635D", marginBottom: 12 },
  h2: { fontSize: 12.5, marginTop: 12, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  item: { marginLeft: 10 },
  rule: { borderBottomWidth: 0.5, borderBottomColor: "#C9D3CD", marginVertical: 6 },
  foot: { marginTop: 16, color: "#5A635D" },
  row: { flexDirection: "row" },
  cell: { flex: 1 },
});

const longDate = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
const shortDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function SummaryDoc({ s }) {
  return (
    <Document title="For my GP" author={s.writtenBy}>
      <Page size="A4" style={st.page}>
        <Text style={st.h1}>For my GP</Text>
        <Text style={st.meta}>
          {s.writtenBy}. Written down from {longDate(s.period.from)} to {longDate(s.period.to)}.{s.appointmentDate ? ` Appointment on ${longDate(s.appointmentDate)}.` : ""}
        </Text>
        <View style={st.rule} />
        <Text style={st.h2}>What is happening</Text>
        {s.happening.length === 0 ? <Text>Nothing written down in this period.</Text> : s.happening.map((h) => (
          <View key={h.what} wrap={false}>
            <Text>{h.what}{h.where.length ? ` (${h.where.join(", ")})` : ""}. Since {longDate(h.since)}, written down on {h.daysWritten} {h.daysWritten === 1 ? "day" : "days"}.</Text>
            {h.entries.map((e, i) => <Text key={i} style={st.item}>{shortDate(e.date)}{e.howBad ? `: ${e.howBad}` : ""}{e.note ? `. ${e.note}` : ""}</Text>)}
          </View>
        ))}
        <Text style={st.h2}>What makes it better</Text>
        {s.better.length ? s.better.map((b) => <Text key={b} style={st.item}>{b}</Text>) : <Text>Nothing written down.</Text>}
        <Text style={st.h2}>What makes it worse</Text>
        {s.worse.length ? s.worse.map((w) => <Text key={w} style={st.item}>{w}</Text>) : <Text>Nothing written down.</Text>}
        {s.around.length ? (
          <View>
            <Text style={st.h2}>Sleep and mood on those days</Text>
            {s.around.map((a) => (
              <View key={a.date} style={st.row}>
                <Text style={st.cell}>{shortDate(a.date)}</Text>
                <Text style={st.cell}>{a.sleep ? [a.sleep.hours != null ? `${a.sleep.hours} hours` : null, a.sleep.quality ? `rated ${a.sleep.quality} of 5` : null].filter(Boolean).join(", ") : ""}</Text>
                <Text style={st.cell}>{a.mood ? [a.mood.mood, a.mood.energy].filter(Boolean).join(", ") : ""}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={st.h2}>My medicines</Text>
        {s.medicines.length ? s.medicines.map((m) => <Text key={m} style={st.item}>{m}</Text>) : <Text>None written down.</Text>}
        <Text style={st.h2}>My questions</Text>
        {s.questions.length ? s.questions.map((q, i) => <Text key={q} style={st.item}>{i + 1}. {q}</Text>) : <Text>None written down.</Text>}
        <View style={st.rule} />
        <Text style={st.foot}>{s.footer}</Text>
      </Page>
    </Document>
  );
}

/** Builds the PDF in the browser and starts the download. */
export async function downloadSummaryPdf(s) {
  const blob = await pdf(<SummaryDoc s={s} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `For my GP ${s.writtenOn}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
