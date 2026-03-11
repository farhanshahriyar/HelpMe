const { OpenAI } = require('openai');
require('dotenv').config();

const API_BASE_URL = 'https://api.aivaii.com/v1';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.log('No OPENAI_API_KEY found in .env');
  process.exit(1);
}

const client = new OpenAI({ apiKey, baseURL: API_BASE_URL });

async function testUrl() {
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this image? Reply with a short sentence describing the object in the image.' },
            {
              type: 'image_url',
              image_url: {
                url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/React-icon.svg/200px-React-icon.svg.png'
              }
            }
          ]
        }
      ]
    });
    console.log('Success:', response.choices[0].message.content);
  } catch (err) {
    console.error('Error:', err.message || err);
  }
}

testUrl();
