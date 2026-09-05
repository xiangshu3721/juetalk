import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Chat = { role: "user" | "assistant"; content: string };
type FrameworkKey = "six" | "vitality";
type Reflection = { id: string; date: string; framework: FrameworkKey; answers: Record<string, string>; chat: Chat[] };
type Screen = "home" | "write" | "dialogue";

const STORAGE_KEY = "juetalk-records-v1";
// 函数 URL 可以公开；DeepSeek Key 只保存在腾讯云函数环境变量中。
const CHAT_ENDPOINT = (import.meta.env.VITE_CHAT_API_URL as string | undefined) || "";

const sixPrompts = [
  ["省", "今日我要反省的地方有哪些？", "不急着评判，只如实看见。"],
  ["思", "今日我有哪些深刻的思考或反思？", "是什么让你停下来重新理解？"],
  ["恕", "今日我应该宽恕自己的地方？", "把对自己的苛刻，先放轻一点。"],
  ["信", "今日我想再次确认或相信什么？", "可以是对自己、关系或生活的信念。"],
  ["愿", "今日我有什么样的愿？", "无需宏大，真诚就好。"],
  ["行", "接下来的具体可落地的行动是什么？", "写成一件 24 小时内可以开始的小事。"],
] as const;

const vitalityPrompts = [
  ["死", "今天什么事情让我感觉更“死”了？", "留意让你收缩、麻木或失去力量的瞬间。"],
  ["生", "今天什么事情让我感觉更有生机？", "也看见让你舒展、连接与活过来的时刻。"],
  ["行", "明天我可以怎么做，让自己多一点生机？", "只需要一个小而真实、愿意开始的选择。"],
] as const;

const frameworkInfo = {
  six: { name: "省思恕信愿行", question: "今天，想怎样看见自己？", intro: "每天只留下一次，过去的记录可以随时回看。", prompts: sixPrompts, mark: "省\n思\n恕\n信\n愿\n行" },
  vitality: { name: "生死本能觉察日记", question: "今天，哪里在失去生机？", intro: "看见消耗，也靠近那些让你重新活起来的时刻。", prompts: vitalityPrompts, mark: "生\n死\n本\n能" },
} as const;

const today = () => new Intl.DateTimeFormat("sv-SE").format(new Date());
const seed = (framework: FrameworkKey) => Object.fromEntries(frameworkInfo[framework].prompts.map(([key]) => [key, ""]));
const zhDate = (date: string) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date(`${date}T12:00:00`));

function readRecords(): Reflection[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Reflection[]; } catch { return []; }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [framework, setFramework] = useState<FrameworkKey>("six");
  const [date, setDate] = useState(today());
  const [answers, setAnswers] = useState<Record<string, string>>(seed("six"));
  const [records, setRecords] = useState<Reflection[]>(readRecords);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState("省");
  const [message, setMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [editingToday, setEditingToday] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [shownMonth, setShownMonth] = useState(() => today().slice(0, 7));
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const recognitionRef = useRef<any>(null);
  const config = frameworkInfo[framework];
  const prompts = config.prompts;
  const selected = useMemo(() => records.find((item) => item.id === selectedId), [records, selectedId]);
  const current = useMemo(() => records.find((item) => item.date === date && item.framework === framework), [records, date, framework]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records]);
  const go = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  function startWriting(nextFramework: FrameworkKey) {
    setFramework(nextFramework); setDate(today()); setShownMonth(today().slice(0, 7)); setAnswers(seed(nextFramework));
    setActive(frameworkInfo[nextFramework].prompts[0][0]); setEditingToday(false); setMissingFields([]); go("write");
  }
  function saveReflection(event: FormEvent) {
    event.preventDefault();
    const missing = prompts.filter(([key]) => !answers[key].trim()).map(([key]) => key);
    if (missing.length) { setMissingFields(missing); return; }
    const entry: Reflection = { id: current?.id || crypto.randomUUID(), date, framework, answers, chat: current?.chat || [] };
    setRecords((items) => current ? items.map((item) => item.id === entry.id ? entry : item) : [entry, ...items]);
    setSelectedId(entry.id); setEditingToday(false);
  }
  function chooseDay(day: number) {
    const value = `${shownMonth}-${String(day).padStart(2, "0")}`;
    if (value > today()) return;
    const entry = records.find((item) => item.date === value && item.framework === framework);
    setDate(value); setAnswers(entry?.answers || seed(framework)); setEditingToday(false);
  }
  function speak(text: string) {
    if (!("speechSynthesis" in window)) return alert("当前浏览器不支持语音朗读。");
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "zh-CN"; utterance.rate = .95; window.speechSynthesis.speak(utterance);
  }
  async function ask(text: string) {
    if (!selected || !text.trim() || isThinking) return;
    if (!CHAT_ENDPOINT) return alert("深入对话服务还在配置中，请稍后再试。");
    setMessage(""); setIsThinking(true);
    try {
      const response = await fetch(CHAT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: selected, message: text.trim() }) });
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error || "暂时无法连接觉察伙伴。");
      const chat: Chat[] = [...selected.chat, { role: "user", content: text.trim() }, { role: "assistant", content: data.reply }];
      const updated = { ...selected, chat };
      setRecords((items) => items.map((item) => item.id === updated.id ? updated : item));
      if (voiceReplies) speak(data.reply);
    } catch (error) { alert(error instanceof Error ? error.message : "暂时无法连接觉察伙伴。"); }
    finally { setIsThinking(false); }
  }
  function toggleVoiceInput() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return alert("当前浏览器不支持语音输入。建议使用最新版 Chrome、Edge 或 Android 浏览器。");
    const recognition = new Recognition(); recognition.lang = "zh-CN"; recognition.continuous = false; recognition.interimResults = true;
    recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); alert("没有识别到语音，请允许麦克风权限后重试。"); };
    recognition.onresult = (event: any) => { const spoken = Array.from(event.results).map((item: any) => item[0].transcript).join(""); setMessage(spoken); if (event.results[event.results.length - 1].isFinal) void ask(spoken); };
    recognitionRef.current = recognition; recognition.start();
  }
  function beginDialogue(record: Reflection) { setSelectedId(record.id); setMessage(""); go("dialogue"); }

  const Header = ({ back }: { back?: Screen }) => <header><button className="brand" onClick={() => go("home")}><span className="eyebrow">DAILY INNER PRACTICE</span><h1>觉 · 对话</h1></button>{back && <button className="text-button" onClick={() => go(back)}>← 返回上一页</button>}</header>;
  const monthStart = new Date(`${shownMonth}-01T12:00:00`); const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate(); const leading = (monthStart.getDay() + 6) % 7; const canNextMonth = shownMonth < today().slice(0, 7);
  const changeMonth = (offset: number) => { const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + offset, 1); const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`; if (value <= today().slice(0, 7)) setShownMonth(value); };
  const MonthCalendar = () => <section className="month-calendar"><div className="calendar-top"><button onClick={() => changeMonth(-1)} aria-label="上个月">‹</button><b>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(monthStart)}</b><button onClick={() => changeMonth(1)} disabled={!canNextMonth} aria-label="下个月">›</button></div><div className="weekdays">{["一","二","三","四","五","六","日"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: leading }).map((_, i) => <i key={i} />)}{Array.from({ length: monthDays }, (_, i) => { const day = i + 1; const value = `${shownMonth}-${String(day).padStart(2, "0")}`; const future = value > today(); const done = records.some((item) => item.date === value && item.framework === framework); return <button key={value} disabled={future} onClick={() => chooseDay(day)} className={`${done ? "done" : ""} ${value === date ? "picked" : ""} ${future ? "future" : ""}`}>{day}</button>; })}</div><div className="calendar-key"><span><i className="key-done" />已记录</span><span><i className="key-empty" />未记录</span></div></section>;

  if (screen === "write") {
    const viewingPast = date !== today();
    const form = <form onSubmit={saveReflection} className="reflection-form">{missingFields.length > 0 && <p className="validation-message">请先完成：{missingFields.join("、")}</p>}{prompts.map(([key, title, helper], index) => <article key={key} className={`${active === key ? "active" : ""} ${missingFields.includes(key) ? "missing" : ""}`} onClick={() => setActive(key)}><div className="prompt-index">0{index + 1}</div><div className="prompt"><div className="prompt-title"><span>{key}</span><h3>{title}</h3></div><p>{helper}</p><textarea value={answers[key]} onChange={(event) => { setAnswers({ ...answers, [key]: event.target.value }); setMissingFields(missingFields.filter((item) => item !== key)); }} placeholder="写下此刻的觉察……" rows={active === key ? 4 : 2} /></div></article>)}<button className="save">{current ? "更新今日觉察" : "完成今日觉察"}<span>→</span></button></form>;
    return <main><Header back="home" /><section className="page-title"><span className="eyebrow">{config.name}</span><h2>{config.question}</h2><p>{config.intro}</p></section><MonthCalendar />{current ? editingToday ? form : <><section className="today-detail"><div className="today-complete"><span>✓</span><div><b>{viewingPast ? "当日觉察" : "今日觉察"}</b><p>已完成 · {zhDate(current.date)}</p></div>{!viewingPast && <button className="edit-button" onClick={() => { setAnswers(current.answers); setEditingToday(true); }}>编辑</button>}</div>{prompts.map(([key, title]) => <div className="today-answer" key={key}><span>{key}</span><div><b>{title}</b><p>{current.answers[key]}</p></div></div>)}</section><button className="save" onClick={() => beginDialogue(current)}>进入深入觉察<span>→</span></button></> : viewingPast ? <section className="empty-placeholder"><span>○</span><b>此处空空如也～</b><p>{zhDate(date)} 没有留下{config.name}记录。</p></section> : form}</main>;
  }
  if (screen === "dialogue" && selected) {
    const quick = selected.framework === "vitality" ? ["我身体里的感受是什么？", "我最需要被照顾的是什么？", "怎样让自己多一点生机？"] : ["我真正的感受是什么？", "我在害怕失去什么？", "下一步可以怎样做？"];
    return <main><Header back="write" /><section className="page-title compact"><span className="eyebrow">REFLECTION DIALOGUE</span><h2>和这份觉察再待一会儿</h2><p>{zhDate(selected.date)} · {frameworkInfo[selected.framework].name}</p></section><div className="dialogue-note">觉察伙伴会参考当天的完整记录。对话也只保存在这台设备。</div><div className="chat">{selected.chat.length ? selected.chat.map((item, index) => <div className={`bubble ${item.role}`} key={index}>{item.content}</div>) : <div className="empty-card">试着说说：今天哪一部分最让你想多停留一会儿？</div>}{isThinking && <div className="bubble assistant thinking">正在认真听……</div>}</div><div className="quick-prompts">{quick.map((text) => <button key={text} onClick={() => setMessage(text)}>{text}</button>)}</div><div className="voice-tools"><button className={listening ? "voice-button listening" : "voice-button"} onClick={toggleVoiceInput} disabled={isThinking}>{listening ? "● 正在听，点击结束" : "◉ 语音说话"}</button><button className={voiceReplies ? "voice-toggle on" : "voice-toggle"} onClick={() => setVoiceReplies(!voiceReplies)}>{voiceReplies ? "🔊 自动朗读已开" : "🔈 自动朗读"}</button></div><form className="message-form" onSubmit={(event) => { event.preventDefault(); void ask(message); }}><input value={message} disabled={isThinking} onChange={(event) => setMessage(event.target.value)} placeholder="写下此刻想说的话……" /><button disabled={isThinking} aria-label="发送">↑</button></form></main>;
  }
  return <main><Header /><section className="home-hero"><span className="eyebrow">A SMALL PLACE TO NOTICE</span><h2>为自己，<br />留下一段清醒的时间。</h2><p>这里收集不同的觉察框架，陪你练习看见、理解，再向前一步。</p><small>记录只保存在当前浏览器，不会上传。</small></section><section className="section-head"><div><span className="eyebrow">TOOLS</span><h3>觉察工具集</h3></div><span>持续增加中</span></section><button className="tool-card" onClick={() => startWriting("six")}><div className="tool-mark">{frameworkInfo.six.mark}</div><div><span className="pill">今日可用</span><h2>省思恕信愿行</h2><p>从反省、思考、宽恕、相信、愿望，到下一步行动。</p><b>开始今天的觉察 <em>→</em></b></div></button><button className="tool-card vitality-card" onClick={() => startWriting("vitality")}><div className="tool-mark">{frameworkInfo.vitality.mark}</div><div><span className="pill">今日可用</span><h2>生死本能觉察日记</h2><p>辨认消耗与生机，留意明天能让自己更活一点的选择。</p><b>开始今天的觉察 <em>→</em></b></div></button></main>;
}
