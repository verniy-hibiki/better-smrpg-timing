const GAME_FPS = 60;

const parseRange = rangeStr => rangeStr.split('-').map(s => parseInt(s) / GAME_FPS);
const parseRanges = str => str.split(/\s*,\s*/).map(parseRange);

const px = 'px';
const moveRect = (elt, x, y, w, h) => {
  elt.style.left = x + px;
  elt.style.top = y + px;
  elt.style.width = w + px;
  elt.style.height = h + px;
};

const DEFAULT_PRESETS = [
  { name: 'Terrapins', frames: '4000-4003, 4254-4257, 4530-4533, 4708-4711' },
  { name: 'KG/GG', frames: '998-1001, 1651-1654, 2098-2101, 2470-2473, 2747-2750' },
  { name: 'Calamari', frames: '669-672, 1430-1433, 2277-2280, 2685-2688, 4012-4015, 4394-4397' },
  { name: 'Nimbus', frames: '2918-2921' },
  { name: 'Shocker (Yarid)', frames: '176-179' },
  { name: 'Shocker (Smithy)', frames: '163-166' },
];

const presentToSelectItem = preset => {
  const result = document.createElement('option');
  result.text = preset.name;
  result.preset = preset;
  return result;
};

class Form {
  constructor(onSave, onStart) {
    this.onSave = onSave;
    this.onStart = onStart;

    this.elements = {
      inputs: document.getElementById('inputs'),

      presets: document.getElementById('presets'),
      loadPreset: document.getElementById('loadPreset'),
      ranges: document.getElementById('ranges'),
      start: document.getElementById('start'),

      settings: document.getElementById('settings'),

      saveSettings: document.getElementById('saveSettings'),
      offset: document.getElementById('offset'),
      scrollSpeed: document.getElementById('scrollSpeed'),
      gutter: document.getElementById('gutter'),
      noGutter: document.getElementById('noGutter'),
    };

    this.elements.settings.onchange = this.markSettingsDirty.bind(this);
    this.elements.settings.onkeydown = this.markSettingsDirty.bind(this);
    this.elements.saveSettings.onclick = this.saveSettings.bind(this);

    this.elements.start.onclick = this.onStart;

    DEFAULT_PRESETS.forEach(preset => {
      this.elements.presets.add(presentToSelectItem(preset));
    });

    this.elements.loadPreset.onclick = this.loadSelectedPreset.bind(this);
    this.elements.inputs.onchange = this.markInputsDirty.bind(this);
    this.elements.inputs.onkeydown = this.markInputsDirty.bind(this);
    this.markInputsDirty();
  }

  saveSettings() {
    this.elements.saveSettings.disabled = true;
    this.elements.saveSettings.value = "saved";
    this.onSave(this.parse());
  }

  markSettingsDirty() {
    this.elements.saveSettings.disabled = false;
    this.elements.saveSettings.value = "save settings";
  }

  loadSelectedPreset(e) {
    const idx = this.elements.presets.selectedIndex;
    const opt = this.elements.presets.options[idx];
    this.elements.ranges.value = opt.preset.frames;

    const btn = this.elements.loadPreset;
    btn.disabled = true;
    btn.value = "loaded";
    btn.style.backgroundColor = null;
  }

  markInputsDirty() {
    this.elements.presets.blur();

    const btn = this.elements.loadPreset;
    btn.disabled = false;
    btn.value = "load preset (enter)";
    btn.style.backgroundColor = "red";
  }

  setValues(values) {
    if (values.offset !== undefined) this.elements.offset.value = values.offset;
    if (values.scrollSpeed !== undefined) this.elements.scrollSpeed.value = values.scrollSpeed;

    this.elements.gutter.checked = values.gutter === true;
    this.elements.noGutter.checked = values.gutter !== true;
  }

  getPersistedValues() {
    return {
      offset: this.elements.offset.value,
      scrollSpeed: this.elements.scrollSpeed.value,
      gutter: this.elements.gutter.checked,
    };
  }

  parse() {
    return {
      ranges: parseRanges(this.elements.ranges.value),
      offset: parseFloat(this.elements.offset.value) / GAME_FPS,
      scrollSpeed: parseFloat(this.elements.scrollSpeed.value),
      gutter: this.elements.gutter.checked,
    };
  }
}

class Track {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.notes = [];

    this.hidden = true;

    this.frame = document.getElementById('frame');
    this.target = document.getElementById('target');
    this.note = document.getElementById('note');
    this.culler = document.getElementById('culler');

    this.setVisibility(false);
  }

  setConfig(config) {
    this.config = config;
  }

  reset() {
    const { x, y, h } = this;
    const { ranges, scrollSpeed, gutter } = this.config;

    this.targetX = x + Math.floor(this.w * 0.85);

    const w = gutter ? this.w : Math.floor(this.w * 0.85);
    this.w = w;

    moveRect(this.frame, x, y, w, h);
    moveRect(this.target, this.targetX, y, 0, h);
    moveRect(this.culler, x + w, y, 200, h);
    this.setVisibility(true);

    this.t = 0;
    this.scrollSpeed = scrollSpeed;
    this.tMax = ranges.reduce((tMax, range) => Math.max(tMax, range[1] + 1));
    this.hidden = false;

    this.notes = [];
    ranges.forEach(range => this.processInputRange(range));
  }

  processInputRange(range) {
    const { x, y, w, h, targetX, scrollSpeed, config: { offset } } = this;
    const [start, end] = range.map(s => s + offset);

    const noteX = targetX - scrollSpeed * end;
    const noteW = (end - start) * scrollSpeed;

    this.notes.push(new Note(this.note, noteX, y, noteW, h, scrollSpeed, end));
  }

  setVisibility(visibility) {
    const val = visibility ? 'visible' : 'hidden';
    const elts = document.getElementsByClassName('game');
    for (let i = 0; i < elts.length; i++) {
      elts[i].style.visibility = val;
    }
  }

  draw() {
    if (this.notes.length > 0) {
      this.notes[0].draw();
    } else if (!this.hidden) {
      this.setVisibility(false);
    }
  }

  update(dt) {
    this.t += dt;

    if (this.t > this.tMax || !this.notes || !this.notes.length) return;

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      note.update(dt);
      if (note.endTime < this.t - 0.3) {
        this.notes.splice(i, 1);
      }
    }
  }
}

// notes move in the x direction
class Note {
  constructor(elt, x, y, w, h, v, endTime) {
    this.elt = elt;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.v = v;
    this.endTime = endTime;
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    if (x + w < 0) return;
    moveRect(this.elt, x, y, w, h);
  }

  update(dt) {
    this.x += dt * this.v;
  }
}

class App {
  constructor() {
    this.form = new Form(
      values => {
        this.persistConfig();
        this.track.setConfig(values)
      },
      () => this.resetTrack(),
    );

    const savedValues = window.localStorage.getItem('tcbfl');
    if (savedValues !== null) this.form.setValues(JSON.parse(savedValues));

    document.addEventListener('keydown', e => {
      if (e.key === 'g') this.resetTrack();
      if (e.key === 'Enter') this.form.loadSelectedPreset();
    });

    this.track = this.newTrack();
  }

  newTrack() {
    return new Track(4, 4, 500, 76, 300);
  }

  persistConfig() {
    window.localStorage.setItem('tcbfl', JSON.stringify(this.form.getPersistedValues()));
  }

  resetTrack() {
    this.track = this.newTrack();
    this.persistConfig();
    this.track.setConfig(this.form.parse());
    this.track.reset();
  }

  update(dt) {
    this.track.update(dt);
    this.track.draw();
  }
}

const app = new App();

// f is a function that accepts `dt` as an argument
// note that `dt` has units "seconds"
const loop = (f) => {
  let t0 = 0;
  let t1 = 0;

  const loopedF = (t) => {
    t0 = t1;
    t1 = t;

    f((t1 - t0) / 1000);
    requestAnimationFrame(loopedF);
  };

  requestAnimationFrame(loopedF);
};

loop(dt => app.update(dt));
