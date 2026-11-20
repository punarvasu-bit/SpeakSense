const $ = (id) => document.getElementById(id);
let recorder, chunks=[], recording=null, timerInterval=null, seconds=0, stream=null;
const toast = (message) => { const t=$("toast"); t.textContent=message; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3200); };
function setRecordingFile(file) {
  recording=file;
  $("selectedFile").hidden=!file;
  $("fileName").textContent=file ? `${file.name} · ${(file.size/1024/1024).toFixed(1)} MB` : "";
  $("analyzeBtn").disabled=!file;
}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;}
$("recordBtn").addEventListener("click", async()=>{
  if(recorder && recorder.state==="recording"){recorder.stop();return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
    chunks=[]; recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{
      const blob = new Blob(chunks, { type: "video/webm" });
      const ext=blob.type.includes("mp4")?"mp4":"webm";
      setRecordingFile(new File([blob], "speaksense-recording.webm", { type: "video/webm" }));
      stream.getTracks().forEach(t=>t.stop());stream=null;
      $("recordTitle").textContent="Recording ready";
      $("recordHint").textContent="Your clip is ready for personalised feedback.";
      $("recordBtn").innerHTML='<span class="rec-dot"></span> Record again';
      $("recordBtn").classList.remove("recording");
      $("recordStatus").textContent="Recording ready. Select Analyse when you want your coach to review it.";
    };
    recorder.start();seconds=0;$("timer").textContent="00:00";
    $("recordTitle").textContent="You're doing great — keep going";
    $("recordHint").textContent="Speak naturally. Your recording will stop at 90 seconds.";
    $("recordBtn").innerHTML="■ Stop recording";$("recordBtn").classList.add("recording");
    $("micOrb").textContent="🔴";
    timerInterval=setInterval(()=>{seconds++;$("timer").textContent=formatTime(seconds);if(seconds>=90 && recorder.state==="recording")recorder.stop();},1000);
    recorder.addEventListener("stop",()=>{clearInterval(timerInterval);$("micOrb").textContent="🎙";});
  }catch(e){toast("Camera and microphone permission is needed to record. You can upload a clip instead.");}
});
$("fileInput").addEventListener("change",e=>{const f=e.target.files[0];if(f){if(f.size>18*1024*1024){toast("Please choose a file smaller than 18 MB.");return;}setRecordingFile(f);$("recordTitle").textContent="Clip selected";$("recordHint").textContent="Ready for your AI communication review.";toast("Recording added successfully.");}});
$("removeFile").addEventListener("click",()=>{setRecordingFile(null);$("fileInput").value="";});
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderAnalysis(a){
 const score=Math.max(0,Math.min(100,Number(a.overallScore)||0));
 const metrics=a.metrics||{};
 const metricHtml=Object.entries(metrics).map(([k,v])=>`<div class="metric"><b>${v.score===null?"—":escapeHtml(v.score)}</b><span>${escapeHtml(k.replace(/([A-Z])/g," $1"))}</span><p>${escapeHtml(v.label||v.detail||"")}</p></div>`).join("");
 const strengths=(a.strengths||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
 const improvements=(a.improvements||[]).map(x=>`<div class="improvement"><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.why)}</p><p><strong>Try this:</strong> ${escapeHtml(x.exercise)}</p></div>`).join("");
 const plan=(a.practicePlan||[]).map(x=>`<div class="practice-step"><small>${escapeHtml(x.day)} · ${escapeHtml(x.duration)}</small><p>${escapeHtml(x.task)}</p></div>`).join("");
 $("resultContent").innerHTML=`<div class="result-hero"><div class="score-ring" style="--score:${score*3.6}deg"><div><b>${score}</b><small>COMMUNICATION SNAPSHOT</small></div></div><div><span class="panel-kicker">YOUR COACH SAYS</span><h3>${escapeHtml(a.headline||"A strong start.")}</h3><p>${escapeHtml(a.summary||"Here is your personalised feedback.")}</p><p style="margin-top:12px;color:#8fe9d1">${escapeHtml(a.coachNote||"Keep practising. Progress takes time.")}</p></div></div><div class="metric-grid">${metricHtml}</div><div class="result-columns"><div class="result-box"><h4>✦ What's working well</h4><ul>${strengths||"<li>Keep practising to discover your strengths.</li>"}</ul></div><div class="result-box"><h4>↗ Your growth opportunities</h4>${improvements||"<p>Try another recording for more detailed feedback.</p>"}</div></div><div class="result-box" style="margin-top:13px"><h4>✧ Your personalised practice plan</h4>${plan||"<p>Practise for five minutes each day.</p>"}</div>`;
 $("results").hidden=false;$("results").scrollIntoView({behavior:"smooth"});
 const history=JSON.parse(localStorage.getItem("ssHistory")||"[]");history.unshift({score,date:new Date().toISOString()});localStorage.setItem("ssHistory",JSON.stringify(history.slice(0,20)));updateGrowth();
}
$("analyzeBtn").addEventListener("click",async()=>{
  alert("NEW ANALYZE CODE IS RUNNING");
 if(!recording)return;
 $("analyzeBtn").disabled=true;$("analyzeBtn").textContent="Your coach is listening…";
 const fd=new FormData();fd.append("recording", recording);fd.append("context",$("context").value);
 alert("Type: " + recording.type + "\nSize: " + recording.size + "\nName: " + recording.name);
 console.log("Recording object:", recording);
 console.log("Recording MIME type:", recording?.type);
 console.log("Recording size:", recording?.size);
 try{const r=await fetch("/api/analyze",{method:"POST",body:fd});const data=await r.json();if(!r.ok)throw new Error(data.error||"Analysis failed");renderAnalysis(data.analysis);toast("Your personalised feedback is ready.");}
 catch(e){toast(e.message);if(e.message.toLowerCase().includes("api key")){$("recordStatus").textContent="Add your Gemini API key to the .env file, restart the app and try again.";}}
 finally{$("analyzeBtn").disabled=false;$("analyzeBtn").innerHTML='Analyse my speaking <span>✦</span>';}
});
$("generateBtn").addEventListener("click",async()=>{
 const btn=$("generateBtn");btn.disabled=true;btn.textContent="Creating your session…";
 try{const r=await fetch("/api/practice",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal:$("goal").value,level:$("level").value,context:$("context").value})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create practice");const s=d.session;$("practiceOutput").innerHTML=`<span class="panel-kicker">YOUR PERSONAL PRACTICE</span><h3 style="font:700 20px var(--display);margin:9px 0">${escapeHtml(s.title)}</h3><p style="font-size:11px;color:#aab8ce;line-height:1.6">${escapeHtml(s.encouragement)}</p>${(s.steps||[]).map((x,i)=>`<div class="practice-step"><small>STEP ${i+1} · ${escapeHtml(x.minutes)} MIN</small><b>${escapeHtml(x.name)}</b><p>${escapeHtml(x.instruction)}</p><p><strong>Try:</strong> ${escapeHtml(x.prompt)}</p></div>`).join("")}<div class="practice-step"><b>Reflect</b><p>${escapeHtml(s.reflectionQuestion)}</p></div>`;toast("Your practice session is ready.");}
 catch(e){toast(e.message);}
 finally{btn.disabled=false;btn.innerHTML='Create my practice <span>↗</span>';}
});
function updateGrowth(){const h=JSON.parse(localStorage.getItem("ssHistory")||"[]");$("sessionCount").textContent=`${h.length} practice session${h.length===1?"":"s"}`;$("practiceDays").textContent=h.length;$("bestScore").textContent=h.length?h[0].score:"—";$("growthBar").style.width=`${Math.min(100,h.length*12)}%`;$("growthCaption").textContent=h.length?`${h.length} step${h.length===1?"":"s"} taken towards becoming a stronger communicator.`:"Your first session is waiting.";}
updateGrowth();
