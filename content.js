if (document.contentType.startsWith("image/")) {
  const img = document.querySelector("img");

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "🎯 Analyze Colors";
  toggleBtn.style.position = "fixed";
  toggleBtn.style.top = "20px";
  toggleBtn.style.right = "20px";
  toggleBtn.style.zIndex = "9999";
  toggleBtn.style.padding = "10px";
  toggleBtn.style.fontSize = "16px";
  toggleBtn.style.background = "#000";
  toggleBtn.style.color = "#fff";
  toggleBtn.style.border = "none";
  toggleBtn.style.borderRadius = "8px";
  toggleBtn.style.cursor = "pointer";

  toggleBtn.onclick = () => startSelection(img);

  document.body.appendChild(toggleBtn);
}

function startSelection(img) {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "9998";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cursor = "crosshair";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let startX, startY, endX, endY;
  let drawing = false;

  canvas.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    drawing = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, e.clientX - startX, e.clientY - startY);
  });

  canvas.addEventListener("mouseup", async (e) => {
    drawing = false;
    endX = e.clientX;
    endY = e.clientY;
    canvas.remove();

    const bbox = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      w: Math.abs(endX - startX),
      h: Math.abs(endY - startY)
    };

    if (bbox.w < 5 || bbox.h < 5) {
      alert("Please select a larger region.");
      return;
    }

    const imgBlob = await fetch(img.src).then(r => r.blob());
    const bitmap = await createImageBitmap(imgBlob);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = bitmap.width;
    tempCanvas.height = bitmap.height;
    const tCtx = tempCanvas.getContext("2d");
    tCtx.drawImage(bitmap, 0, 0);

    const scaleX = bitmap.width / window.innerWidth;
    const scaleY = bitmap.height / window.innerHeight;

    const cropped = tCtx.getImageData(
      bbox.x * scaleX,
      bbox.y * scaleY,
      bbox.w * scaleX,
      bbox.h * scaleY
    );

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropped.width;
    cropCanvas.height = cropped.height;
    cropCanvas.getContext("2d").putImageData(cropped, 0, 0);
    const base64 = cropCanvas.toDataURL("image/jpeg");

    try {
      const res = await fetch("https://flask-color-analyzer-1.onrender.com/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 })
      });

      const data = await res.json();
      if (data.colors) {
        showResultsOnPage(data.colors, bbox.x, bbox.y);
      } else {
        alert("❌ Could not read colors. Try again.");
      }
    } catch (err) {
      alert("❌ Failed to reach server. Make sure Flask app is running.");
      console.error(err);
    }
  });
}

function showResultsOnPage(colors, x, y) {
  const existing = document.getElementById("color-results-box");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "color-results-box";
  container.style.position = "fixed";
  container.style.top = `${y + 10}px`;
  container.style.left = `${x + 10}px`;
  container.style.background = "rgba(0,0,0,0.75)";
  container.style.color = "#fff";
  container.style.padding = "10px 14px";
  container.style.borderRadius = "10px";
  container.style.zIndex = "9999";
  container.style.fontFamily = "monospace";
  container.style.maxHeight = "300px";
  container.style.overflowY = "auto";
  container.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";

  const sorted = Object.entries(colors).sort((a, b) => b[1].percent - a[1].percent);
  sorted.forEach(([color, { percent, rgb }]) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.marginBottom = "4px";

    const swatch = document.createElement("div");
    swatch.style.width = "16px";
    swatch.style.height = "16px";
    swatch.style.marginRight = "8px";
    swatch.style.border = "1px solid #fff";
    swatch.style.background = `rgb(${rgb.join(",")})`;

    const label = document.createElement("span");
    label.textContent = `${color}: ${percent}%`;

    row.appendChild(swatch);
    row.appendChild(label);
    container.appendChild(row);
  });

  document.body.appendChild(container);
}
