/* Chart generator */
export function generateChart(settings) {
  // Wave mode: deterministic repeating 0,1,2,3 pattern
  if (settings.wave) {
    const chart = [];
    for (let i = 0; i < settings.length; i++) {
      chart.push([i % 4]);
    }
    return chart;
  }

  const chart = [];
  let prevLanes = [];
  for (let i=0;i<settings.length;i++){
    let noteCount = 1;
    let r = Math.random();
    if (settings.multis) {
      if (r < 0.05) noteCount = 4;
      else if (r < 0.15) noteCount = 3;
      else if (settings.doubles && r < 0.35) noteCount = 2;
    } else if (settings.doubles) {
      if (r < 0.20) noteCount = 2;
    }

    let lanes = [];
    let attempts = 0;
    while (attempts < 20) {
      lanes = [];
      let available = [0,1,2,3];
      for (let j=0;j<noteCount;j++){
        let idx = Math.floor(Math.random()*available.length);
        lanes.push(available.splice(idx,1)[0]);
      }
      if (!settings.jacks) {
        let hasJack = prevLanes.some(l => lanes.includes(l));
        if (hasJack && (noteCount + prevLanes.length <= 4)) { attempts++; continue; }
      }
      break;
    }
    chart.push(lanes);
    prevLanes = lanes;
  }
  return chart;
}