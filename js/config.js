const COMFYUI_URL = 'http://localhost:8188';
const OUTPUT_API_URL = 'http://localhost:3101';
// ===== FORMAT PRESET =====
const FORMAT_PRESETS = {
  tachie: {
    w:768, h:1152, steps:32, cfg:7,
    sampler:'dpmpp_2m', scheduler:'karras',
    label:'立ち絵',
    promptTag:'full body, simple background, white background, standing, straight standing pose, character sheet'
  },
  sd: {
    w:600, h:600, steps:30, cfg:7,
    sampler:'dpmpp_2m', scheduler:'karras',
    label:'SD',
    promptTag:'chibi, super deformed, sd, full body, simple background, white background, cute, small head'
  },
  illust_v: {
    w:832, h:1216, steps:35, cfg:6,
    sampler:'dpmpp_2m', scheduler:'karras',
    label:'一枚絵 縦',
    promptTag:'dynamic pose, detailed background, illustration'
  },
  illust_h: {
    w:1216, h:832, steps:35, cfg:6,
    sampler:'dpmpp_2m', scheduler:'karras',
    label:'一枚絵 横',
    promptTag:'wide shot, landscape composition, detailed background'
  }
};
const OLLAMA_URL = 'http://localhost:11434';
