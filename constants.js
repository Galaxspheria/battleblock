const PROMPTS = {
    'Write a Shakespearean sonnet about your favorite breakfast food.': {'time': 11},
    'Write a passive-agressive haiku.': {'time': 11},
    'It was seven in the morning, and Arnold was already ': {'time': 11},
    'She suspected they would come, but she never thought they\'d come now.': {'time': 11}
};

const WORDS = ['Queso', 'Laptop', 'Tiger', 'Gobble', 'Instead'];

const PROMPT_CONFIGS = [
    'adj+noun+verb',
    'adj+noun+adv',
    'noun+adv+verb',
    'noun+location',
    'noun+verb+location',
    'noun+verb+noun',
    'noun+verb',
    'adj+noun+adv+verb+noun',
    'adj+noun+verb+location',
    'noun+location'
];

const GAMETIME = 306;

module.exports = { PROMPTS, WORDS, PROMPT_CONFIGS, GAMETIME };