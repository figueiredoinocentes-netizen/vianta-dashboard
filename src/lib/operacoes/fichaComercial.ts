// Geração da Ficha Comercial imprimível (A4) — abre pop-up e imprime.
// Layout pensado para meter no carro: o comercial leva o papel nas visitas.

import type { Carro } from './types';

const vazio = (v: unknown) => v == null || String(v).trim() === '';
const txt = (v: unknown) => (vazio(v) ? '—' : String(v));

/** Formata número com pontos nos milhares: 23000 → "23.000" */
function fmtNum(v: unknown): string {
  if (vazio(v)) return '—';
  const s = String(v).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
}

function linha(label: string, valor: unknown): string {
  return `<tr><td class="rotulo">${label}</td><td class="valor">${txt(valor)}</td></tr>`;
}

function secao(titulo: string, body: string): string {
  return `<div class="secao">
    <h2 class="secao-titulo">${titulo}</h2>
    <table class="tabela">${body}</table>
  </div>`;
}

const logoB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAawAAABWCAYAAACTtqJnAAAQAElEQVR4AeydCZxdRZXwXyeEhHQ2Z9BBGBVlRlERcGUHET79YGQdRWUXERURBQVCkt6SAAYREVERUYGIIAoKiuKnsiUIioILLuPCJm6MhqydhCz9/f8n7z5fOv32+16/7tz+1emqW+upc06dU1W3br0xuewvo0BGgYwCGQUyCowACmQGawQwKUMxo0BGgYwCGQVyucxgZVLQvhTIMMsokFEgo0ARBTKDVUSMLJhRIKNARoGMAu1LgcxgtS9vMswyCmQUaF8KZJgNAwUygzUMRM+azCiQUSCjQEaB2imQGazaaZaVyCiQUSCjQEaBYaBAZrCqJHqWLaNARoGMAhkFhpcCmcEaXvpnrWcUyCiQUSCjQJUUaIXB2oK/A8CnG78LXzh3yy23nD1mzJge/J4JEyZcMH78+HnAWTwfsdVWW+1F3N7A64B9BsG+PBfAvNRr3v2nTp1qO3vxvNekSZPeij+L+mYTP0+ftmfid+O/Fng2kLmMAqOAAlkXMgpsHhRopsH6j7Fjx96MEVqzdu3a72FY+tatWzcbss4eN27c+WvWrOnCoPQ+/fTTvatWrZqOf/bq1asvxL9p5cqVC4lbAHwfuHsQ3MVzAcy7fv16896+ZMmS73V0dCwUli9ffh1tzaG+LsJn6WPo5oBLH/F3gMPvgR8T3hrIXEaBjAIZBTIKtDkFmmWwdsJY/XRgYOBQjFBu4sSJOYxMDkOSw0jkMFY50nIYkRyrrBx5C+BzAsYn4VI+Ri9IbLoBjFLUbxhDFvVjKGm6Qxw6bJfVVw7DNRE8Xkm5+8j7L0DmMgpkFMgokFEgZQqkWV1TDBYG6l6MRGdiMPr7+8Nw+IyhiLCGBiuSM468GpCcvs8JDH5O4ot969OwWZeEYcWVY9svl9RvPPiEgdRQabBYccWzxo30HYDPWTaDjAIZBTIKZBRoXwqkbrA6Ozs/hoGapNFwNYUxCOMhCXjux7+d7cH7MTQL2C68F6NxL/4C0u4G7iF8D2XvFTA6xpcF6rqbldKd5L0Lw3UP9d3H8w8p/wPauof2f4QRW0C+H7LK+yVxYTD1eQ4jSbnDafv9xjUAYxsoW03RjmoyZXkyCmQUyCgwWimQusFasWLFBzASsd2H4UgMwq9ZLb2a52ewwjmAPK+BoPtiMPYU2Dbcl7T9gL0J781W4Z4CRs34soAx2o+6DqDc/rSxN/XtQRu7YzT38pk6duN5X/LtTngX8k5ihXY8BmoJRi22K8lHdO4i/j0HqNetq7dgleUGqsxXLptGTyiXp7G09EsPJ77PZDLzDrq0LdBs1+wJTz34p64f6kEiK1OeAkzWD0CXHVM+1+hITVUgIdz/4Z1QUEajxWCP1QzGZF8iPeDwNH4z3HoqrUaha1RWkHc+xvHfMWA/B7fYHgTvLYBvk1a3o/zpbD/ORXg82DELesylsp48eDqxWkjK6Hu6cjZ1Ge5hW3MOq9D/os5aXQf8OIx6+oBZ4Hk++PbmoQff+jfBj/jIT5k5hLuBPvp3I3V9i/Bswr2AeQTrS+oasj6Q3qSNojjLJNBLvHW/CL9VbjL9OoR+fYwGldcnmcxcQdjVOl7zHBOod1H7LEAaym/pHSdpwSdoii/9k3D48EX5MG83uB9M+dQMH3L2n9SX8GOwXw0f5Z/96UNuX0pd4bbeeuvJBGaxG2I/Iw8ylPh9xAuz8QtAunLXS38DoEX0n3rEayhcjC8L1BF1WSfhHn3aEQ/lWhz6iJfmAfm25NEcwucAnjbGa6lTZ+9Ii2eiY28CvwH02HfQZ18k7nhgVDs7n1oHWclsy+oljBThWF1BVOv/u//aDJaD6+4opJ+gLOIdGvg5qDQ2BGt31PdxVngzqbObfnsicSZ1q3gdXNbbhxIIn4ERPgLXR94I02L4PDvIe1FAlu2j3q4kDgM7C/gGeWt1sGTgawh3F23OYQV6LgO0h7qFXvxe2uijzcCBPCqIPgqpDFSIswiLazer3yNp/CCeuxgoPUA39Qo91GFdDnBxjrrIW87vSWiC35unl0ojlA14vI3yrXA7Qo/FNHQLtPgA7b6SsI7gGFfeb/ShSbAzNPwkDc2BftKwCxmaBR6C9AxQZkiPMHxSNnrJ1wftVaLKyfXgl5qBp+43QRPlosAXn2mjC3CCEnyFZ+ETZ17DgRvPPeCmfHWD+5t4DvfUU08dST1zGCvW04M8RR7kyXA37XabRnwXccpYF+Fu6NHDc1Jn0AF6xNiCdspmgGEgwSF82usZN25chEFCPA1vVB/tKsvmi/bAXdnXaNmnPvppGY2V9P4w9VwFtNTB9wX07de84vgotDgC8DDbWH3STmopMsPQWKoGC4ZfzUzqz/jx3goChtGiXycC7ehWgtTrURYrGAxxAIRnhfQl+DU7BPp0Cs1FeD5L2NOHcWKRmWKH9ZOWw9jEiUja9DFWdxEY4h/1xJZlvuwD+HOh6ZzJkyf/9xDZK0ZR/kBWViq46xD6R8QBIxEnN8E3cCFPHFrRR0kEHxm4YdDB51F4ews8/hr+V1AWKpTbUEa/tXHrIGx9Yyg/1rDx5QBFMkaaiAf1Sa9fkP9a2naFquL+Os9Nd+B+Lv0bQ7+iLZ7DBz/lYgzPx0VEc/79HL4eS/8vB4fHEhyI67B9aUNY2qicAgN5Qt7glRHgJ91duXyFZ328xhxtfBV4E+30Iit3IDtLeX4aPMeKE+GYnOoj4+IWp3CRLcN/A6cF4D932rRpRy5atKhYuXclZfTFEj/KUnf00zhkKMYL9Hiauh4nz0LCOZT1eukhkI8iHbZHcGNHQuCnHFK2gz7kxFPc6VNO3/rwH6bkfeC9xnheWdhG6C5xoGxhzFqn7eb951JuT6BVblvw3d3GeMUR+IuvYB9J2w/aOLkyy6iEVA2WFFq+fPkhKNQQFAgYAoKgzyOtXb93WgRur4Lhq1DEBHMqAb/hmhoPNfxjQHwCAe8CTkHh7k1RV2xfZbYYdGBgEJULI6SQMUDi2X8OgAR8Nl2g7GoG627U7Yy/i+fuZcuWfc08dcD3WVk5Mz0aHHeh/nM1FtQdxsr6iAsjJS4+m8YAfYz8b+X5+cBh8NgV1lHEueV5EHW8jPiTyPuEAwk/6oAGRJd31BHKhjp+Sd8cjDtT4ljgPBTFXOp6kHCz3TNo50hxgdbRFviEDIND+KQfQsI0oCmOsXIt8B4q3x54HXz4Hc8xUZCOhpWXhC8YgsBLPFXC5hFIfwnj7TLq6AAadf9DBTcCrjAORHZU0F+ijY2MCrj6yUhBhqDjjcTtAc32A6euxYsXK6+PUY/Od8s7MN6iTGdnZ/DfPkhr6xZIX0rmrxP/dvxtqOt5+PsAHcjYv0APV0fLzUtcSQcuYXyQ4aAXMpbg+V3qeR0Ft4CGO+CL15b4+0Fnvwd9nD44CQhjldDbOOu0XXDowEC4NUixlrizkM/Q2bQbsqFOIS74oU+fpFdLkBmORqLzKTf8AAr1IAQ1qlVAEPRnwfDPRkQuNzbvN92roYHfI7SvATQOHhjZGaF1kFrFeP/VAb4v+xXl3kxds6UDAs5jLgd9NIoxUB0AETnEP9LWMDg8rPKjIZIbjVpGBfMQ8o/DmxB+B6EDG37FICW8jvQzwPsF5P0yUMr5bvILJL4QWA5EffTbYFmgfxq3X06dOlVl9MOymZuXeCKKcxL0DrxVBsVN2Q9osxX0aOa2YHGTd/DwQvCYb9uEY8KD0g7F5ITQsPiCU6xCzAOOIVPwz9XgW4wDtgDScL4nXkJFb4dnx4PXOuUGg0LUBoehVG5s28nNI8QOfq88BkN0qmXEnfScqxn74PjQJ24xaceiP/6V8BHEuzJ7inCxE4/Z4OHNNoV4+++DvmDYSeiSJUtcJQcYD+7zSfM9sHR2nPKYs3/qprup9xxkXgP5Iuj8fRMxBPYtDBj4hdFjbOSIP5R0Jxl4zXXQ++22Df62GytAdFbIrP0CV+UkM1h1sOE2ypwIgWMASUwIfThxbwYSASHYNm4tmPwChr8DQc2hvBRuj7kfSPxqoCHHAOhhMJ7iDDI/qDWKMeMrrlg6CcZBL71f888tMrzUXQc1DtDnD4DXWnmVb1MDYv8dEO8m/RLyOZjxKrqVzPiudCCrKKRlpRL2lzbORqmolMSpUpFmpJ+u4lQRSAOUZPDGsPhBn1BQ8M4VUDPaH7JOlOHx4HCL9BQnDFjkc8KT8At6B27ki0kQsmaeDmT4cgKvAJRtvFTdfGgyT/6KlzWLB4byGuJ8+V+qTVdGR1sGnqtcLRr4E1jEGJkD/ir/a3kuVQdJBedE7uPJkzQwrC8Yti3qDX5q6I0n7gOkrQEGu8G6ya3uA+mTh8YeE2flwULyxGfDyHorXnmcAM2nAmGg5L842H7SP336Jv3c2TFp1EEzVlgJka6GuL6kjFkJTFdonIVPSTK0oX8tA+aERBAZ9H5Q7ExPVBtSpvT/swjUjxnU1iUtQvDioeifA6ro0Zlk0WOqweLZ7/3gFpWDZ+AFHTxxdGVE1vCPGd+t0o9tw+B7paL5/i7M5yvGKR/VdO81KKHtmfmHkbY1cUpAI6ZyMB5DsQe+M2+8Rl115cHjKHI+LX8wYDEB5Dl4ZJzyJO7GkTeMlmEMsFvaGi19o9IGt+SiPWkE3w1/pFwj0PE05YtxFdlQruET57bjrqyqfH9ck8wjpw9YiX3XHwzooIgiX+xswOt7iPA1AF7VbgE5NQTvAcdV9hc/N2XKlJBxZF2DldZKlqaGdGe7MjVFfht2nGEsQxbsJ/RN5GO6+UYjNNNgSS9PmX1O5voAozshqsLpYzuCRuka8J0BrjmUwXMR8M/nEW1YmTIwz1DY8GNf3UFG/fnqc8lMs/BMYDug6Q6cBlQ4rCCSbQ9nyW6b1NP2X51tq0ztZ6UKzEce31fgtd4x8E+XD/A8VpbyQ/zFBFl1lZnQxKgOaNXqLZfV4HaSCpe2Q0ZUUiIjfaWfykp5JV+s3MXfZ/B/Nb5H9JVri6QJrsqX2Ka4iQfhh2igZFvgeTLpsQ2oD34eejqTsDsvf8Svxz0i/5KCSVhfoP8a0uCheYirdrfA7IPhcuTlpfT3x9J46dKlySTHScxBgzOn9cxKahfkcgcNPDQLHmMkQ16ZmISRkv7KA/3zMIa7Wc3W7Wl1r6Z6WtGpkyHmjRA9ZgIQ9UCe3eeuCdEWZU6M0gUIpXvnNusetd+3GG4UFjKoFyL0MWilSYUKfXfki+4K2RpLRpHsKC4YaAfgImZupzVQ40MYv/XwOQZSpXrId3ulPE1KV7FuTV993xIzZegQOIN/KDifbRuexbujvLI4hTjL4rXG0e5jKiLxcFtQZWXLKLEwqMhqTICMU0HTJ/mYgAY2eZ9lltQA+jzIWA6DAC6+r7XuZAwZLoZjybsdEHHk/wflfY+kQS1VJvJW+FfQYdLIvIlv2PZcmer7jNFvaCWE0fBE4YHQON7JI79hOBjTTdsupo0P0Kfx9gGahawqB4aJW8D6aAAAEABJREFUt1shBz4jK77TnEhkQ0fcKd+WrsDsZmIHwT1B9huENIiNcnSr6d+b2WYKdZ/M4P9CHmdXhckJsYYEHrwuQbAGFD6EPmbMCt1gIF/imi14zwWXyfAo2gOPSwnUtC1D/sFujHRL6hycWPzMAGuUnsXV1RJWSZ5Kf33RHgYJuQwlry/+ghWi5PRiwkXg2SgnD4gQbI1DXmJVAJ/iZF2Cj4ZKDMSzWCkbh+yG8bUvPDvedsJP1dHG3fJYQ0o7fsNWsn5wPMm85BMvL8Z2VeKhh5JlqkyAhQMxjmgjihARzz44xvTFUR8chnp3ZVItsATa+6H30fAkeEP9rrD+rZZKqsw7GTofCayjX8psGEj5TVxMrPQF+w9epo8Br/9bZf0jKlsrDJazUbd8XgHBfwZjnQ0w5rYsd+qsHYiIbK87HQF4EKGfgDBck0eqmpfB+axDejdScWxjKGRD5iiKRPC8GqgoJvXgCfRxHBDv1Xi/8JnUW2jfCk+x39A4DtrA48AUfoefPCd5fEZwNRqxtRWZWvAPAzlWWUFuQhEzhgqKq7h5xlek6yfx9oV3LZ08Xwc081cJHOc0MaR7NrTbP0+7J8DP033eODNk5hESKQ+ugyfXM6EIlDHGMyKQ7r/jqX8iNBurHEpDjZUrLJuh/ZhkmUaeQphnv9Ucdb/5V6vBcjbs9yjSqlqQseZ1v/pQZtRuObkPuyeD0P1r09oVPKL9WgbbwwjDIexbp7I1SF3zEagwEJU6jkC6EvVlf6WsdaXDj1PWrVsX34aB023sif+1ropGXiGvqYotKmi8jn6vxxDEjBWaOKmKwY+MxuqLPGEM9FFMh9Hdln1XyDbUWnhDkzm3/jzJdpcKC0XmaiXARORKrwA+g2vOdy3Irj/544nPcoalUDblwD6075j3sIMnb/VTbmLYqjuGvl0hf+CHVyaligh1z6TCLdBBeDl/W1A/ZNI4wYgSflO2gm1vuKBWg/UvDGBfxtdaLunf45R/LYPIW9tVCF7N0pKDBQkCdfhLUWDnUc6DCb6/INiw+2QtNTCrauSdUqmmVFw7MtA0iPFdB3zxap9S+UdVPDQ9GwUThomOfZtV1p/hczxDkzBcyGoYKeMNs9KJdFYtnnTVaFG0JW41iitwwni5hflG3rP1w69NjJVGSowSX9x9Jr+eF6R6os1w2pBMTIeq9wZWBX6kq6z5MfJQeUZsHLR1e/BwaO5kvl7dOFT/d6PuZ8l7ZHINMui7dd8ZDhAOWbSQxiqBQc9+mmPUqIFaifskhPszg/sN9VKAWazfO70Wgq8FpjHo/Gar3upaUg4F9XmEpoN+75pSg/9LPbH/j1/WqXBo/2gypX08eYC63wlQdZxQ/Bvt3BIPo//fthgrT9C5329vL2Xl5Hsew06kYgaLrIdBIG/EYSziGWOn8Wj2u8XAxX8YykkorgFwDANKnFeJ+eKf4MZOxZXEoEBjIiK+8pl6fLdxCc/eTJJka5Xv+yp3WWptL+385QxrI23dTGE/oI93WoQbdujG09E5Y+G9cnoP8nghla5CHuOqN1fZ8rgUkNej+K76nOTwOPJdrQbLbSzfwVxE1xu5r+x+iH+Cgwsl6cvgZqwgUlXwCI0n37xiiq6n4q5Q0CrVhHCGkkLhpLW6KzQJD97GBMIZm3Hf4p8f7+KNbocimE7f470d9PXKIJXplYRVDBqjwket5Iv3W0yuwljJM2nG86uhkgoBr7kOQ+nkbgCDk/DKBu/lXy8Q8iFegs+OK32BvroVF33yFChpU8Df7yGTQ0Rmy6D9KLAtMhYXP2O05LG/GtBP+HrkYL2yyqo1sIanIZuJb2RR2PdqbiMbPeKhZoPFAO6dOHGi19R8usHef4kZ4/usg9WLhiD5QNeohoE6/QjR7Q+3vhqqj/56JY8fKPohcUN1FRX2a36vRyqK2jSI0IbyREDddqj3mqhNK87lDoCX8VJW4SZDPTfAU2zkOSZJJ3V2eg4hp4G6mh54kOZPzFjvhM4qBw9WhJInLT5BgFbxLD+Mo45xrFSULx+bCkxWfIdBk2vC+BQ15kXLtxcbqjwvQ4GZj0J6sUIUd/tHP72X8vxISO9fs1YulTCsqV34WFP+So03Mf0dTJI70JF+V7UU30uNbe4rTDxg5ZjQC0YI8l0wnED+2W3KzXeFBTHWQbATGCTuhze6R3oZlL+KQeXgj61B6k/FwewuBvqlKJWGf26B/noZq3vwLvlTwc9K6Ht8y2G4FEDnRHnuQH+8aqdU1primam9nfpixg6t/kJhLyjFG/XuGOjeuWLFCg2QM9XCJIQZ65WkBQGkDUrCHQXzRZzKHoWnAtHQaTz8xinSmvzP1f1420aebSpRQB51PoKIJ4GCyyuqMLz2Q2CMRV/MRD/F/52EPUmGN6JdwxPSduw9PDuNSfd6eckK2xWxkyrfW7kT8gdlgfhA3XAC6oskrE8GV9LxrSHhEe/G1NkDryrxgz9PHTX0I2YQ1cs0/TmJV8GkNE8N9qNgLmb7w5/5cB+3zq7mPA3mh84VV0O1NkDfz0cgY7nu1o3lMSR6BeVCeihI8vodUKxII0OD/1DMh0Mfla5Gy5stGqyxvuIOsPpK1l3qbEsiaw7+bxJ+HEjcTdDf30mLFYmR0l3DZTgBDLy88PG51ONExnDTQD4pB9IKebadkBkDgJ+MvAl+EsyF3Iivz5axrGCiRss4gTyu2lxdPt+0esG6LJu0YbjVIF0SGKrtBMeh0to07mDo+SxgjP1CBtW1BVSRuZt8YKUc/LZ/5jNuMOT1SmwtDk4bic/1GiwH9JkQwytKnJk/o8HO+5X4L2CQ23ieJGqwukLxS8HRPt5KjDMNvJqdPz6ZxseGQzX8D4TPCzzjJT/KMmbFzKykb8zsVTwqSLYlPXruzQBpfEtzOMqr0/YQ9nUoQT+MHgq/0Rb3H3RoZwc3sqahduZKVMGthC5xUlK6C4WUCGz6D2XinYubJrQ2ZgF4dCHr6+yXTYu7/TRcBjqRNcdvmSxZ0jBQYObUqVOdULm1eyft+54Vb4ODxxfB69WulBMeM443JPI/Cevn09Ub25A04p3KvO5OMLhPRplOQ+gbvV5nFUjsjlJ2tlu4fZm4Rpx985svr4Z6AQy+i8pSPYhBfQ07aPgpcPP7mhBQFI9Xq0S9zIKTmXzEsTU5BSOj8EV6A/9Ot03rR6B/Tj3D9bMeNJ1r5TuFOciqht/tlScw1J7sEocCQJcrHeiCvCgklAhgGDzenur71xJNVYqeiyKLm/2ZBMXKWaVXqRDjdxdo8tFK+apIbyUfq0BnxGZ5HjK455IlGy6bYXy6Ch7cmScZu3FzUHGCMisUx5EvefS1RhIesb5KvRHkf8aA7UPod2V56vdZyd56PXWij/tfyx79/hROQyknx0tvgGmPouh3hpleZLsF9beT89Rlv7OlYqTANZb7xkGTQpi+fIi4DqBeN37ChAl7YyiTOuVbvXWNpHITpkyZcgiy6qXGyoCrq02ULHS5HyXxsDSvpnMYCVfu3txQTfZ681TFbwzsERirv9mI8pMoPZ9LAePCydCZ+F6YWipbFt8iCqBPz0AG490VPPS6q+SGnY0wgNcfIT12ZJDX8DfKwIPxeLn8ZcntsBMgOg1BowbLrSuP1v4EhXtsZ2dnoy/3FjHr9Z2A99lt2VDPigozY3kbQuAL6iNZxXk8tOF+F1XfaHAlwncDeBXqwfiHACqQCHDMlqGLL8o9GbQzGev+vRsUkz+KN866aVeF3e5XZNHdVNzRS5cu3Up65o1RqQMv61H6X/RQBn5VDTMBaNk3WRUQehQD+i4VlfyF124pbQSmFQMToJArfMdF0y9aroD/5p7suDwevoV+godOqpKJ92Da3ML4LX6XGTrDTMX8Vd69LJk6/fbuxaaPZAjC1NmBcUk5thTeBnEXs0T6FMpAwiRJ9fg/pZAXN5ZSKCTX5jBW9zEgr1MBgaMnu9pFwURHMKiXgFeExRHjH2EFD0GLsP8Q0HjXRdgfoMOr3cGnMyxl3YQ9PPNnn0c7MHBnQ9sx0pBVlkf4S/6cBfmuQo4L27GVaEOdHjxK891rpSbLpd+MrF9GH/A20mdDliFfKDqM7jPpc7zMHzJjFtl0CjDW38y4fAaMkyfrkCsPtZVqdxl64zrGcGFCYkbK6xXAusgX78OJ9NMYvJHrGjFYhYMIKIDfQaguwCtrGjngkFDydxDZjzm9ATmJa9R/DwIQx38RDI2hv8HTaJ2plMeg/gzFcb+VMUPW80CAq9eC0nTVBf4KsjPio3O5XM2HL1BKz6eO1yRCDr8a/ZYucG33f9B2L/q9HTKVoFq41SKJKPZXrVr1CPm/WxxXLszqdzwGsZ22XN6HTD0ETuXQjjRlQaVGfidDfp+V1jvkqD/7VzUFxsKH05C7p5HTAXZc1Ae+0y9ZATz7CjyOa5rkozA4s3Hkk7fqjWZfpD24+dSfGzFYg5G5jIgFEOc5EGmTl9mk1eSox9+j8oRMTeXKZPa4su9//IkTt8JuIG/dW2uUTdVhqK7AkCbvlULAoGMYKAQ4rtjxGYG23Qn883e68Kp3KOI32AaGynrdakj127fqMWltTmj2HozWOleuDPBHab3iFVTwYz5lyFreUZ/y5OSirVbt8Pgw+l3x5hKUZOCvr2zQ29MBD5LgZa6FFPA36XajvS3RfR3suHyKcCV3C/L3pHqhFCAHHjJyvDv5nQSP01wEVMIv9fQ0DZbIeZv5Ioi0L4S82IgGIe27x+bD2NtZEcZLbLZAfgB+7WK0rkdp/AMl40woBAz8QC8XS/4cf9A10gh2sFqq+aomtm5PYTBQPKdh9PSRL3Xjebj+2d8mt91JG8dggOInOgg7EaqmyRsosww5TrZTpFlC/yjP4NdQxeSCScUORHpdE15bOI9CH4fM+E4u8CYc3/SJtyCW0CPw95n+GqW8+e6k4rVTGHSqHAj6WE8U3vAv+187BWZCzCiFjnJcOqGO53L/GM/Xkz9OGJtPPlqPcfqMeQ8ZBf9Ng0/vNd9IhbQN1nK2ruL4JITxXYmrgI52Ig6K5XQYOYDvYQa3ML8Pfq5Y8IbVLaf1b2KInAnFMXcMa8x+2XIKRaPwQdcwZqyW/MmR51CmWvdKhPvlCrKnhqjn69UWHOH5zsLwe4w9Bi19cTsYr6JbTY6vQKd1Gi3lhXBs1RIfjgmGyj14BG1NU+YjrU3+fZvxeJm4CSosZQr5DwWHwQk07Zt9sZ/QSlnzu8qK77MwcI2cCo62s39Bganw5gDoOUaewB9PBip/kVjuH/z9KLxdL++UT+qJiZVheSm/1RvUnfDcE9hxJVu5ets1LW2DpTX/NgRKPkT1vrwXtlPnUf6/BJ/fy0CZS9ibLDb6kpy44XJXYIhCCSpwCiHCqALx6HGA8SoXDRuKppabQY60rB1bvny57/K+Y3iUg5Ol41EA3urgBMWt6loOmfhN1lh5IC+UF7ZqQonNMjcAABAASURBVCEYRs5j8iANVTTIltcktdO3fuvZBn0/uP9UXPFFNeTLiYsPnZ2dscIyrHzQh7gKDGX3cvroaV2ThgTqK1aqbrMPmS+LrEiB/2JMx8+IQHPpeEHFEvkM8PeP6IHfKH9GaaDkI3Ex8YWPoTdMh19htPCPNO9IhFQM1uCOQzSvMnoCwkyCUH5J74xtcLZhe2awPgle0T4CovNetXge5n8/QNAeRcGGElHwwDW2ncRL4SPdo+0heChST/1UO8s9Fn64CrAqL9IsVjbGjUZ4Pcx9PnQKI0MHq11dkTXcvdDMrbUY9PJCxS9fTEXOYzvM+lE43uruSr3tvmcC34PB1Y/oA1/lSPl30ubx/cmTJ0e8fTKeF/4GlTGvAivZH8qn9ulJNLiZ/kNGPwyEjMGnuyFDTT+iivxdrM5QN1A2xrjyaNgJiD68Ch4jC06y2m0nQBSrgqYYLFpeieAfDRG9XPTFbEG5J+5sl6Rhd7uA114w2QEpuF3kSnDYERMB8LoQJRlGSiEG1zBeCqPCR3rMgM0LbAUcBVRyfn/xXOtlQJjXAzL6oxowMKdrYKQjA/gROlvzqpJy862Dsg70UCrItnITW4zS1Gf5JH94rvuTA9toEvwFGsQpRvCLAzziC32iuWXLlkV/2F6KWbmrSPviKp5yXg485H2DpK+PCrJ/dVOAcb0bMuZPicTKl4rcDsSr3k2dOvUm9MLTQBSivtAfGif4F3Hy3XR5DO93wPeAR6SNpH/NMlgK/gIIE4qRLajDIFg7rGLs7xdQQLHnC07yaiUM9mSU4XYAD0PEYZNE4BCuMFoKn1s4KhqFj36Ib8Ub85lRz7SvzLJ8H/MwhX4DjGoHzZ6D/B3U398fypj+e9jCyUmt/f4kyjvKISehVOQLiiaUgnwwXt4Yps1dUeTPq7WRZucHx1uRF993RFPiqxyBazxrdNleCiMM7aKf+e1pP59Itvgjb/IPumQGKyFGnT4yE7sk8McJ0f9Sjbfx4FXtOpYsWfIUfPyyPJV31gWv41UC8hi8VGblsRNW88HrWl4nVI1MszOqwJvZxnQGdmypQKzP0NDuwLA5mPkJGn85TEN/jQmFA17+1tWGi7tIbAPXDw7eGq4Ah7LF0BCVi5f7buFA08KhDIyRPzlS9j0hiuVQOhx18O86YNQ7BuS74G2Hg5O+DzBglb96+v1XBv0CdgmirPVRV0wg9GkjthtVEobJ67uymk9wRuVN/ofc9yA7cd+guIurRgll5wQzFJt9gHZhuBJ0MGwvJ37w91n+6m1msBIi1ed72OJExrC6yJ8uGnJiUKFq33m563IDPE0+3YidAMZ96BD4F9uEiR4hnzLr8faJFepuu+QxTcbI268PhiFuDTog/Bh4uK5/OY6BeGrR/rxM64WJ7hk3mQy1VY9AXYECjA8CoV0oRxSNQhn70OAcYWtFKMehTMqtXg9GYCdbhvxUvb5exU3xEeOU6/dCwzD4dPohMPem9n3x9wP2BvYC9I3Tfx103JM44/cnbLxh036uYoeOodhJCz6QN56Nl095GqskWvLDjrZfI6xgRu/1aYs1Vpa1L/bNGbnG2LDGmXyOj6CfeembP9fuCTOLCSpK72Q0PJKgXV5NOCk4ExntYAxLP28OWsg4d1J/AL6fSCh7iQwa3oeM+8CzfYsg5JlJxzL45GTXesm2wRGn3lUmg5+MhfCJn0wbb9mQa+T8d2A3G9tfwZA+CUVDE1jlVPxok3xpu52YZV8OgwqKHoY9BE59aTeUUn0a0ccRyoJCRGGE4IFzCJ/t0KcQPhSNBqvUC/C3qIysizK/BUpeSURay519SLtR6PFWDMg0eBw0o36vC1tInDf2+zH6AmiykHivpjJO//vQ+B7ijL+dsPGGF1Du/TwX6K6BQtGE0ZKupiHj8YEm5c23LTg4g/UxFbBNK0p8w3XCrygX20HSR+A5nLJlwP7IF5+T9uwnffanV4q3O2OrtLgOy7caxDGBodo2TRz17ddQeYYjDjofD07rAJtfg/9FJgoe9Pke+PqzQ8plyCAZDKsX7qbcXUVwJ7K8gInGnei3yeRzha8Xsm9/qSsmHkYmz7SlnJ5l3EiCVhgs6TGbf/dJOFY5uzCYv8Rzq1wnDX2JtmP56yCkfWciBxLftg4leaVKELxL4mia/WGrZzIzrKFmS5MQ4uMQZgXWi+UuLFnZ8CWkPuNFsZ4q7aChgzKMOoM6BjL0iL19aBY9duCWA2RF2kVelbYBlEXUSTsxobAd8yHbcYLTPNR5qn6bwheQm+ulhX1gEhlbSPZBhaa8kB50oh+F7STSPPVbOLhCv6s9odqmZBhWtA6h9e0AyD5Ww78l8uVH3mulvTLGmA45g+4lfcoH7/TNpw9f4pWB9agjBOMHA+kvIG64drxounbXKoOl0Pty8Wm35Bgk/gKml9DWjnHtJS5HWb3MgZcwlPbfRDXxMwz4rXM1tITC/QIKpXBfY6mi9guJH8PMzG2ojZQ/8YfR1w5pjtC6hbM5fCz8LGiyF7yObWho+DAD8x4M1HcJ3w2d7iZ8J8rAFdRd0KUcOKO9CxreAy1/rBJRuRP2nUModNoJo0WeUCoqe9Op11tf/OmRUqwb1nhociI4eodlnBoUZ+ICJ2gT20rQKoy1fYyEDf9ehBeHqZDR7B0WxKjHYZxORk69nV35WUv4dui9ABlbiL5SNkNWiV8ALAT0NwHyKpuWuRO59hvYpdQTPEXeC6jB65i8FfskjgePdjpwBkrlXcsMFsLtDwWe4ZFZBwRofZ6ZgMetCTbHwbCTaetYGBnKBH8ABvkx5Leb02Kqtf4JBVLxrj+NkcoS8GdZnpXHIAwXccdRhx9zO2HwMtel+fRR66F4ex2UDHBvZveorzepu///egay+/3C/hgW4yvBftDQPHvjewz4YVdRKJUwVvq2lRCTPLENYxxhx9YxSVob+qvB/0Tg74yTMEzgHGhCG5VohP3nM+PIYBL/XujsYSUnQRHPv+Iwj5krQ4HnMQl4PTIaeol81yIz/qaasrY/ekpf2RP2hS/7APqbAHmVzX3w/R1Bv7ebDm9iuxp5p+rSjjadeLkz4/uz0hnbKMVB1Up0vNDxe/kBMIAR85eK/ai4GXjshLK+KN9WMtAeZIB2tbLDjbSFkH5CoSpVh2meGlRAVToMgqRvKo+JDIg3ADFbhtaekCxV1WiJ3wqanWBnpA2+N16n9c5uPaurmEDgh4K3DYF2QkFA/5jFygt5AnzQtDYGf8onLoTeYostog9Jf+wD46eAuuPIB+PtJ3T+EuGXGJdBzRQ4jfHoR+bqJceqk+iaKylR4Hp03AD8iXFfIk8hGl76szgau0JcOweaYSgq9ddbrVdD0A5WO9uwpHWbyq2FNHGZAiPm00Zck+Mg5PkfIOY25EhaZbgqipsvwH0jZ5+MgIYxS3M2hYIMZW08yuQknkOBoni8imkkrCpFvRE4msJb2W/6vA7/cp5Tc6yu+pwA4IfBQqZiRaWPrMVnBzbGbDfSifOD212MaxBixdxgHaWKX43sXAOtnG0X8oC7N3fEStJIv/+DpirY6DN0mEw5t/ZNzqB6CmwJrd85derUhN5PUNTdJ7xU3FPsXN0mvzBcFSuUz/Dy7IoZ2yRDmkai2i79EYYdgbCH8DPT8PiwikWjVW0dZfPBgKtpY1czqdBVIAy2mTynKRhU1xJX9kNC+hp0VGnSx0lgpFH2KPypCiwTAgfG94gf9Y5tK6+c6XAQYrCdFDkZSrPfTyJXP7RC5Ur68hz0R0nEoQ7TXIHpS3v4MhJuxz6RMfIzZcmJELRTZnKu3omPlZdh+2O/k3wqRfs5wqCZxr8iKZCXo6Df1CVLlrhNb/7U7zFFp34GPnrIKiYXNlIKyOekxC1zLwIvlW344/MYDIfBcvbpbP8GB4YEg4keyCh5Z1ke12q996IkDldpWUClgjJRcY3U74+usB8Cgr6JAGr4VSIYK+lqulfwbEP+HaFDcoJopPadblTt9mDb6qXSAhiALl+lpDfg46XnkKfLqT+MlPLLcyh0lESsZpG1eOFti/k4f70gTqga16bgttTRyNBi+wbtCqtFZYj4QFvfNH3jNWKRkP2rhQLvln5MrpzgSHc/FailfDV5b+7v71/t+20zJ3pD3+dikI/I6XjiPLSF195uWAxWniQnI/yLHCAaF2ZvHnVv9BBG4QST9doODHkYhhS2yowbYfA3BO02laOCLvCsYQqwLxp9FKXC7761L2xnmce8pP8J8LQbXuuc7VfTGrxPZcYLfd5te9SnMbHOWi+6tXg1cINtSPM8fWOikBRE1pJgGDDyed+jp1IL8bUGkGVvlYit32rpWmsb5Pf7rA9qgGnPFbqyFH0gLWTNNNunT7ECM74dQHwEcRG/wcDYMCmMMLxTNuJ5GP5tA57++nXQl/b9JvUv+Kk79OlnMVrBP9oMP5HXpDHpZFgfGo2IbcHhNFjLINY7GQTrIK4rga1QOhotP36r9fsOlYLvLr4j8RFKZy8x4GCSl8Mupa0R6xC4z9gnFYmd0CcuhNBnVqj2l653OBA8Cv9etmtiYGKwpanZWgogU1V74DlEvpqjtmLyc7wzSukCffwJET+4rLmiKgr008ZN3gYhTyrlRxGYJbZpDdQDjJEO60GWXc15hU891VRT5vNsZ86nvTBQ9k8+loNqKm1yHtDrCHxLtcPKW7o5RvxObthOxCHr8+QhYzIx+FeWwrnReLZyr1VmiuuBUMWPoT/ERz6T4Ddh3gZDsH3dcBosqXITRuqTEDcECkbuirLxtuLYfzVDlbASo3cdhH+eTHG5bTkG3nvwfwKMdPd1+rYo6YSzeJUzfY5Zo8/QThp6ue04Ddjy5cudkfsRYrNWGgk6m/jwMFYdgwfMJhmJYFspDRmMAybOKJEnV1hV/54QKNTsoPtVtmU/KxWWN5MnT3bVW3xDRKVig9OXYyQjDsNc6kaTSG/038qVKz0U9bh0tE3HUzlotL0UyvsNUxgs8RxcX8Ij+2KfMF6pvSsf3FaF56noubcwIQhjBT4ryO+rEbymuPuRvV9KEyFpgXbDUOknccizY8YJ/oeTuHb101AWDfWNAXgOgvSYShaGSjjfZVW8gXxQo/5uz2EKpzMG6jTZI/MtV9Y23AxAqK7CAGuEnCXGt1XSy74qfNKP9LH2HzrEPYQYsf8Bl98BLXXgofDHjLZSw0wu/F2ujkr5yqXT324MetBGepDX32DDa46D7t+A5n+0n5VakC/+fAf5apVpimxw0GhKvl/Ji/oNCc35v5bxeATKzmP8JVsoVoIlM7UmIWQHfoQiHtykdIN+YSSUEWTFLA3pPSuoAw5DXsYzIYixAR7qplon5jU1Cx9to2QZaWaiNFJvoC883t7W71uHg3HSqBhWQbATHSAQ2BMrKp5LyODpQbySLnBHGM13KeU1dpZ1dr+YUkcATRUI6m+ZQ0n6rcZKhYxwtCu9DLgb3Q59AAANuklEQVSSgYbRdwzbWtLRJx3S49Omtxgm03goCAZAxaaZ8XqBavCyYuahMxwJTZ5hWw46aOF7Ad/bDZ07pVja+wZKp2JtKknyms+PiLc2UCtAo1e4otb42UfKN/qulypKO2TpAVJPww8jAH15/KfzWfhnzLCGxkkT8UmgGBvkoTBxMh/8UDeEkSvO14LwBW4j2454Yrw8TNWI3FtVWYB//g5h2RVlsuJzzKJD/SmZht63lkUohcSmEqwG/O5k8MdyFGUbyg5Buxlj5F1XpaqREZ0M5lvN4GAW8srBr/BH9Hsr+zQI/JmWB6BLGCbTEPow8AhabA3ad+i3hcrNwUket1fxWucwoi9yQCYDoVLL8MyfRql3YuG7zosZbPFeAmOtcvLS0ErNNpyO4qvqQ2zokWxXeQtJvUfct6c9J2JOQsTd77v0mwmfRr5ulJfloJkIVFn3JpMA8bUscqE8xIpGY4GOcbzIh3rlzWrrgWNoe5v8Nr189IDUr6lIHYbXNLcUGtxXqnbS4kQrejayMBallRPjtj3i3i4Gy4E4kxnBryTilClTFLRpGCN/yj2IOcS/sSjFb0Fsvz1SCAIYZN7A7q3bQxSpI6qNiiBQV2CQYktQtBgEHlYJAybd6Huk+X6F9G8AHmzBa52Dh6+yNXjnOzWDZQG8PYLvsdqy+UokvhMj7TU3McmRNuRL62YLqirrfgO9V5bNQWJiaOinysB7255JdK3uJfZNpYsMWNafntBvNvgrAH+wEY1AAsXPhocT4P/u0rYUDk4Y5IHGQh+5DPkslb8J8Z3g91lkZQwTKn+XzSb8xQD9pgN9/rJ8SxoCl2QCFVHg5EGtCJsPPL1s4YMR0Yb/2sZg5WlzCEQbyO/5S9hXIJBDrhKI72Y/eF8EMPb1KWcVXjXTa2A0AsJ3DUZq5YoVK1R+IWgOSFdTrrJIK/x8CvQZrh9q/E/aDvKDb/jl/uX55oeL5bINlfYilPfHLJ/vuzddmy+NmyWspyLQ/pcrZRI/+WI+lIFbLu8wXAPsQfn9VTSJ0mWV7XVK/1pDHfVmfQr8D623cIvK7SdthKS94rBjgz7EpA5+JZMoXyMk2ZvqMz4/TfueYnZy2ZEfGx7C0TA0te185d6WE0HwCD/5J52cCBkvXtIKWVOfesTdX7lIsraN324G62Eoc5qEZOUUQgYxjyNu8BUw+zFok3vzQnGT5+9A8Q/M8Tj6HLS5SaFC+QV9WNHkJk+eHB013gB5FmMsvmm4xbATbZ8JxGo3waccDuCp8ZWXbu+Vy1qc9mLqvo+yE1RCDjYSO6QJ/pFAS7Y0aP+VtFXWIb9BC2liRnDtxt8RqMZtRf7LVSSWFyyEgZ5E2CPRrXgX8yv68D7wCHmjXSeSKjVRKYZW4FLcnuH3QZtXAvGuzQgBfOPZeHgU+BqnfOgjM9eSrxW673O0o/6KLXvC4aChtHprPDT/3/Pp83ogWqLt4KMP0kcfoxoyath0dIr3HLblKqsVTJMOtcCnIOQdrpwUNoTLweEqyx/hs57tGDw3MzPokNBGkMe9YI+w+/2NUaMWEKZ59F8lH4NSGrgiNU6a2XHCrd4O1NgcCx/udWAkfFNBiE85oIwDyFny/yOfv66KV9K5QpmDgf4hdU9zcOHHdiB+yANx2zOZ+Q31pvoDioMwchv6auicyOSg5H8+YliDT9LEMBMxZ9sPEvbXY/+ZcdPQKeR9EnruDEQd+kk2wp6m9Qc590jimuhfBv7xjSPb8EFvxmg0Rz/imXTHYMS14J9byHORg49UasvxAa2Cfgnu4OqFr3cgJy+tVL7O9GORDT+nOYnxGncyIp9RlXRzG44Hr6Obh/9vQFMcvNkbPK5lTGyk56VH0iDprvzUsWHYxRe6mOyrlRkE2uoncjbqCMi1i/tvEFmSJ5zW35NkP+BZAbsYgk8FgsASHGHwPi6v4qHYqHe/YIb9a/ocHVXApIH0gD6x5cGAvCoSm/SPdo6kTX+UczaGwV/kXYli8LJhFbkvtkOJ2TyDJfhUyhdv+qNCeR0KZSHvabxxwdVDHwP7YgbdPNq7gPrvoY5/4M/CQE+mXQ1d1G07PksL6yPfs6HBt8DRn5P5GnW4TSy4lVbr91A7034PbcwGt0s6Ozt9Wb4M3I6n/mif9kr65hE3yge+vl/keQL8uwOD9AvifZ/RRfjz1OlE4yra+znlPgNdJuFHOX3KRbioPT/0/MG0adMeoJ4LoY1XnO1EuBnOY9lPuB1t5dJZnMRFf+LEiU37Pgz+7Un9Tki7ac8dhr8iKzORg/E8l6S9acqERkKceYUQsmkYeu8LfR+CZn7+MoP6NH5OImpenY8dO/YgeDaXOr8MLR4hPJ82XwE/Y2UlzaQX8hPb1k4syaORcOvtr/TtCcpdTJxjagb1qf9EsxY4jvbPow53K26dMmXKGtpcAO2mUV/oBX3a2UiGwDNoAi0cg4Evi4GYENP4efThT9RxH3VfBXgfq2Nhe9IquybkaFeD9RR9/aBERPFosGTuJJ49AXZUQnSeFVZPwZxH/s3GIXhxa7gD0k7zHMImPaCXpwlVgiY1BWh3NoOhC9/BsTftjkMBx7dfxAUupMuzQtjnoUDcGRSRV4XCe5oX8/wO6umm3jOo92yUznTK7mlnCEdeZYC+Rv0M0pARlI9ZksEWg5TyhwMOsh6MjUrJuxYjXzX/wO8y8OilvS5wez/KZ0dwU+4GqDfaB7eSPmUDD3EzzOCPvPhjUQw7Ua+/zzWbfr2d5zeS7wSUyMuAMPr61l+E60YrGerJLV68+OWknwU4a38QvxnO7+UOsD37D12iH+AdbeGvjEAT/kHnBf39/f40UR/tHgGNpikrNiVtygH0DQWNUQjFDI2dxMS7XvsC3vuT5zziP0TddyNLHoyx6qoBHt0KzKSOo/C3p77gOc/BQysC5xzyM0baYRw9VLYmkQcM2HaUU9YdT+ch17VOvn0ndg31zKDsbNo6eOnSpXRvi2hf+lB/hEmPseKz8WSKFRZlwliJqwCOMZ6hz0Tovxv5T6D+udColzKnmmc4oF0NlrRw//erElUmG4GF9zeeguAKBfGLYIACpoEzy2YB9NkPV5cjRHEqEKHKOSDznVfYN1Jq+fjUPAbiGfBlHvSfDi6+k+nFyHSBz1ziZyDgzhR7GZDn0qgrm5Jgeeo7j7x98LSPwXAu/fFHGHup/1LirqDOXuqexWDp5llD1kseZ7QzyT+bsm5dzCKuh+cZGBUnMF082+5McOihXA/xcwj7nRZe1e7D5JxL+93UbV3iNpPn84nXENpGKTD9HPDrA5cucOiGNpadjq/Rn0E9xs8gzZn+beTrI246bQnmmc5zNzToE2hTGvs8i+ce6rGN6YwN+9sFjd5Mnma539LeobQrfz+CP4uGusFPnJu2qkeZegu/tLe/vRgr+T4HGoXsgYP0lw6bALhpBHoxeGcha25zzaUP50CvOfjKnDzoIZ98nQOvLqS+mhxy+iHqmol/PnychWLvoy0V+2z8GeCZyKZyOx38Z2MYLyL+HMrNwhfvWZSNPtK4kw+8qt2PqMN+zoT/c5Ah6XE248q+zQWHkCP4ZR+78B0v8nBWvv2QHeKVU/E9l9XrRdDkbMB+OOaktStc6Vb2g+Sqsa4jYzsbLLvjNTFLUYbOSHIIQsxcVM4Q0hmeguyP9Jl3c4J+aGDfZ0CT2Qi6A7KPQdDNQKzq+6AGieXJIxWpe/Aagb5Vq1aFkaDeC+CNA1DloLLXLwnktbyKT6PUywD6MHGRH//9gNtcKsTzSJvDs/lN76Lv5xNnW17FZPuzeTZsfXPBxXwaltmUc4A66H5GfNWOwf4tMqsMHKjWFXWi2GzDOn0uBaarAFUgGj1xtw7pluBt/AUomQNox/du0mEe/RDMY177bbxgnPVEfyljG/Oghf1VOfnLBEQ3zblt2UP/3c4SB3HphU7zm9UitPHbIOlmX6W1fNf427bPgmlDgfQ1/SJoKh+UgQuhl770VF4sp4wZV/NdjcjWxfT9fHwnI9LEdvpoT15dgG+csike8lP6ObFTNpys2b7ynfTxIuqrxfXThvw/H77YB9sRJ8eisisetmu8+eyzceJlu8ZpyMX7Y9TluJW/7kjYD+kcQJr1t/z2nIQY7W6w/I7oLQhsrBjYqw+8mS25vPVIcdMGSTTUxv+gge95QvAYKAqiK5o5DES3BNsY8wy1jAIZBVpAgXo/jl7VAtzqbqLdDZYdu42l6qUsed2r9wNjV1mPkuDPSfjFOMHMZRTIKJBRoDQFspTRQYGRYLBcTc1kKfoHtwbZJ/Yd1hsgv3eC4WUuo0BGgYwCGQU2BwqMCIMFI/qB43iJuJbV1nTCfn+Cl7mMAhkFMgpkFNhcKDBSDJb8uJd/Hm325SHBMi5LyiiQUSCjQEaBUUeBkWSwJP7meCLQfmeQUSCjQEaBzZ4CI81gbfYMywgw4imQdSCjQEaBOimQGaw6CZcVyyiQUSCjQEaB1lIgM1itpXfWWkaBjAIZBdqXAm2OWWaw2pxBGXoZBTIKZBTIKLCBApnB2kCH7H9GgYwCGQUyCrQ5BTKD1eYMai56We0ZBTIKZBQYORTIDNbI4VWGaUaBjAIZBTZrCmQGa7Nmf9b5jALtS4EMs4wCgymQGazBFMmeMwpkFMgokFGgLSmQGay2ZEuGVEaBjAIZBTIKDKbA/wcAAP//gofJZAAAAAZJREFUAwC7dQKNjxSVUQAAAABJRU5ErkJggg==';

export function gerarFichaComercialHTML(carro: Carro): string {
  const v = carro;
  const isVenda = v.tipo_gestao === 'Venda';

  const modelo = v.marca_modelo || '';
  const title = [modelo, v.versao].filter(Boolean).join(' ');
  const subtitulo = [v.matricula, v.ano, v.combustivel, v.kms_atuais ? `${fmtNum(v.kms_atuais)} km` : null]
    .filter(Boolean).join(' · ');

  // Preço
  let precoHtml: string;
  if (isVenda) {
    precoHtml = `<div class="preco">${fmtNum(v.preco_venda)} €</div>`;
    const credLinhas = [
      ['120 meses (10 anos)', v.credito_120_meses],
      ['60 meses (5 anos)', v.credito_60_meses],
      ['48 meses (4 anos)', v.credito_48_meses],
    ].filter(([, x]) => !vazio(x));
    if (credLinhas.length) {
      precoHtml += '<div class="credito">Crédito desde:<ul>' +
        credLinhas.map(([l, x]) => `<li>${fmtNum(x)}€/mês (${l})</li>`).join('') +
        '</ul></div>';
    }
  } else {
    precoHtml = `<div class="preco aluguer">${fmtNum(v.valor_aluguer_semanal)} € / semana</div>`;
    if (!vazio(v.caucao)) precoHtml += `<div class="credito">Caução: ${fmtNum(v.caucao)} €</div>`;
  }

  // Foto
  const fotoHtml = v.foto_url
    ? `<img src="${v.foto_url}" alt="" class="foto" />`
    : '<div class="sem-foto">Sem foto disponível</div>';

  // Especificações
  const specs =
    linha('Marca / Modelo', v.marca_modelo) +
    linha('Versão', v.versao) +
    linha('Matrícula', v.matricula) +
    linha('Ano', v.ano) +
    linha('Combustível', v.combustivel) +
    linha('Quilómetros', v.kms_atuais ? `${v.kms_atuais} km` : '—') +
    linha('Potência', v.cavalos ? `${v.cavalos} cv` : '—') +
    linha('Caixa', v.caixa) +
    linha('Cor', v.cor) +
    linha('Garantia viatura', v.garantia_viatura) +
    linha('Garantia bateria', v.garantia_bateria) +
    linha('Volume bagageira', v.volume_bagageira ? `${v.volume_bagageira} L` : '—');

  const tvde =
    linha('Categorias TVDE', v.categorias_tvde) +
    linha('Fim elegibilidade TVDE', v.fim_elegibilidade_tvde);

  const obsHtml = v.obs ? `<div class="obs">${v.obs}</div>` : '';

  const timestamp = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
<title>Ficha Comercial — ${title}</title>
<style>
  :root { --black: #0D0D0D; --white: #FAFAF8; --accent: #C8A96E; --accent-light: #F7F1E4;
    --gray-200: #E5E2DA; --gray-400: #9A968B; --gray-600: #5A574F; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body {
    font-family: 'DM Sans', 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif;
    font-size: 11pt; color: var(--black); background: var(--white); line-height: 1.5;
  }
  .pagina { max-width: 210mm; margin: 0 auto; }

  .topo { display: flex; justify-content: space-between; align-items: center;
    background: var(--black); padding: 8mm 12mm; border-bottom: 2px solid var(--accent); }
  .topo .marca img { height: 36px; display: block; }
  .topo .meta { font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }

  .conteudo { padding: 8mm 12mm 6mm; }

  h1 { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 22pt;
    line-height: 1.1; color: var(--black); margin-bottom: 2pt; }
  .subtitulo { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray-400); margin-bottom: 8pt; }

  .cabecalho-viatura { display: flex; gap: 8pt; margin-bottom: 10pt; align-items: flex-start; }
  .foto { width: 65mm; height: 65mm; object-fit: cover; border: 1px solid var(--gray-200);
    border-radius: 6px; flex-shrink: 0; }
  .sem-foto { width: 65mm; height: 65mm; display: flex; align-items: center;
    justify-content: center; background: var(--accent-light); border: 1px solid var(--gray-200);
    border-radius: 6px; color: var(--gray-400); font-size: 10pt; flex-shrink: 0; }
  .info-preco { flex: 1; min-width: 0; }
  .preco { font-family: 'Instrument Serif', Georgia, serif; font-size: 26pt; line-height: 1.1;
    color: var(--black); margin-bottom: 4pt; }
  .preco.aluguer { font-size: 22pt; }
  .credito ul { margin: 2pt 0 0 14pt; }
  .credito li { margin-bottom: 1pt; }
  .credito { font-size: 10pt; color: var(--gray-600); line-height: 1.6;
    border-left: 2px solid var(--accent); padding-left: 8pt; }

  .secao { margin-bottom: 8pt; break-inside: avoid; }
  .secao-titulo { font-size: 9pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--accent); border-bottom: 1px solid var(--accent); padding-bottom: 2pt;
    margin-bottom: 2pt; }
  .tabela { width: 100%; border-collapse: collapse; }
  .tabela td { padding: 2.5pt 8pt 2.5pt 2pt; font-size: 10pt; border-bottom: 1px solid var(--gray-200); }
  td.rotulo { font-weight: 400; color: var(--gray-600); width: 40%; font-size: 9pt; }
  td.valor { font-weight: 500; color: var(--black); }

  .obs { margin-top: 6pt; padding: 6pt 8pt; background: var(--accent-light);
    border-left: 2px solid var(--accent); border-radius: 4px; font-size: 10pt; color: var(--gray-600); }

  .rodape { margin-top: 12pt; text-align: center; font-size: 8pt; letter-spacing: 0.06em; color: var(--accent);
    background: var(--black); padding: 6pt 12mm; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .secao { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="pagina">
  <div class="topo">
    <span class="marca"><img src="${logoB64}" alt="VIANTA" /></span>
    <span class="meta">Ficha Comercial · ${timestamp}</span>
  </div>

  <div class="conteudo">
  <h1>${title}</h1>
  <div class="subtitulo">${subtitulo}</div>

  <div class="cabecalho-viatura">
    ${fotoHtml}
    <div class="info-preco">${precoHtml}</div>
  </div>

  ${secao('Características', specs)}
  ${(v.categorias_tvde || v.fim_elegibilidade_tvde) ? secao('TVDE', tvde) : ''}

  ${obsHtml}
  </div>

  <div class="rodape">
    Vianta — Dos Inocentes, Lda · Ficha Comercial · ${timestamp}
  </div>
</div>
</body>
</html>`;
}

export function imprimirFichaComercial(carro: Carro): void {
  const html = gerarFichaComercialHTML(carro);
  const w = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes');
  if (!w) { alert('Permita pop-ups para imprimir a ficha comercial.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 800);
}