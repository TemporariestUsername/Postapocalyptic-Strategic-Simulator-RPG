"""Generate the BURNLANDS soundtrack with Lyria (via OpenRouter)."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from orgen import gen_music

RAW = Path(__file__).resolve().parent / "raw" / "music"
BASE = ("Instrumental only, absolutely no vocals, no singing, no spoken words. Video game soundtrack for a gritty "
        "post-apocalyptic wasteland strategy RPG. ")
TRACKS = {
    "title": "Main title theme: slow and ominous opening with a lonely reverb-drenched baritone electric guitar and wind, "
             "then deep taiko war drums and distorted low strings build into a heavy, epic, industrial climax. D minor, 80 BPM. Cinematic.",
    "map_a": "Overworld travel music: steady walking-pace desert western groove, twangy tremolo guitar, dusty hand percussion, "
             "sparse low synth drone, melancholic but adventurous, loopable, 95 BPM, A minor.",
    "map_b": "Overworld travel music, second variation: brooding ambient wasteland soundscape with slide guitar, "
             "distant metallic clangs, soft pulsing bass, harmonica fragments, lonely and vast, loopable, 85 BPM.",
    "town": "Wasteland settlement music: warm but worn, plucked banjo and acoustic guitar, junk percussion made of pots and "
            "pipes, a hint of accordion, bustling market mood, loopable, 105 BPM.",
    "bar": "Wasteland saloon music: sleazy dusty blues on an out-of-tune piano and slide guitar, brushed drums, smoky "
           "late-night mood, loopable, 90 BPM.",
    "hall": "Warlord's throne hall music: tense regal and threatening, slow heavy drums, low brass, grinding industrial "
            "textures, dark choir-like synth pads without words, 70 BPM.",
    "combat_a": "Skirmish battle music: aggressive driving industrial rock, distorted guitars, pounding drums, gritty synth "
                "bass, urgent, loopable, 140 BPM, E minor.",
    "combat_b": "Skirmish battle music, second variation: frantic western-meets-industrial action, fast tremolo surf guitar, "
                "tribal drums, metallic percussion hits, loopable, 150 BPM.",
    "army": "Epic army battle music: huge war drums, massive distorted guitar riffs, epic low strings and brass, "
            "wordless war chants replaced by horns, relentless and grand, 130 BPM.",
    "boss": "Final boss battle music: apocalyptic, furious, doom metal meets orchestral horror, massive detuned guitars, "
            "pipe organ, frantic drums, eerie psychic synth swells, 120 BPM.",
    "delve": "Dungeon exploration music for creepy pre-war ruins: dark ambient, dripping water, low drones, "
             "detuned music-box fragments, radio static, sparse heartbeat percussion, unsettling, slow.",
    "maelstrom": "Psychic storm music: eerie shimmering synths, reversed sounds, whispering-like textures made of "
                 "instruments, dissonant strings, pulsing low drone, hypnotic and frightening, slow.",
    "victory": "Victory theme: triumphant but weary, soaring electric guitar melody over big drums and warm strings, "
               "hopeful dawn after a long war, 100 BPM.",
    "defeat": "Defeat theme: sorrowful and bleak, solo cello and lonely guitar over wind, slow funeral drums, "
              "the world burns, 60 BPM.",
    "creation": "Character creation music: contemplative and mysterious, fingerpicked acoustic guitar with ambient "
                "synth pads and soft wind, a sense of a journey about to begin, 80 BPM.",
}


def job(item):
    k, p = item
    out = RAW / f"{k}.mp3"
    if out.exists():
        return f"skip {k}"
    try:
        gen_music(BASE + p, out)
        return f"ok {k}"
    except Exception as e:  # noqa: BLE001
        return f"FAIL {k}: {e}"


if __name__ == "__main__":
    with ThreadPoolExecutor(5) as ex:
        for r in ex.map(job, TRACKS.items()):
            print(r, flush=True)
