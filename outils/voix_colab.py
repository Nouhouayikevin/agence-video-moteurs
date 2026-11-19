"""Voix maison sur Google Colab (carte graphique de Google, pas celle du PC) : exécuté SUR la machine Colab par outils/voix_colab.sh.

Lit /content/voix/ref.wav + ref.txt (l'échantillon de nan_serieux/voix/, VOIX.md), puis chaque /content/voix/phrases/NNN.txt
(avec sa graine dans seeds.txt, 42 par défaut) et écrit /content/voix/out/NNN.wav. Réglages de la maison : VoxCPM2, guidance 2.8 (VOIX.md).
"""
import glob, os, re, sys
import soundfile as sf, torch
from voxcpm import VoxCPM

D = '/content/voix'; os.makedirs(f'{D}/out', exist_ok=True)
seeds = dict(l.split()[:2] for l in open(f'{D}/seeds.txt') if l.strip()) if os.path.exists(f'{D}/seeds.txt') else {}
model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False, optimize=False)
sr = model.tts_model.sample_rate
ref_text = open(f'{D}/ref.txt').read().strip()
for f in sorted(glob.glob(f'{D}/phrases/*.txt')):
    n = os.path.basename(f)[:-4]; out = f'{D}/out/{n}.wav'
    if os.path.exists(out): continue   # reprend là où elle s'est arrêtée
    torch.manual_seed(int(seeds.get(n, 42)))
    text = open(f).read().strip(); m = re.match(r'^\s*\(([^()]*)\)\s*(.*)$', text, re.DOTALL); cont = not m   # same mapping as VoiceStudio (voxcpm2_subprocess/main.py):
    wav = model.generate(text=f'({m.group(1).strip()}){m.group(2)}' if m else text, cfg_value=2.8, max_len=min(4096, max(256, len(text) * 6)),   # a « (consigne) » = controlled clone,
                         inference_timesteps=10, retry_badcase=False, retry_badcase_max_times=1, reference_wav_path=f'{D}/ref.wav',  # otherwise continuation of the sample
                         prompt_wav_path=f'{D}/ref.wav' if cont else None, prompt_text=ref_text if cont else None)
    sf.write(out, wav, sr); print(n, round(len(wav) / sr, 1), 's', flush=True)
print('fini', file=sys.stderr)
