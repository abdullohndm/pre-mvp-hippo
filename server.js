const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require('fs');
const http = require('http');
const Readable = require('stream').Readable;

const app = express();
const PORT = process.env.PORT || 3000;

let duration = 12;
const steps = [{
    "name": "Induction",
    "wpm": 120,
    "wordLimit": Math.floor((duration * 0.15) * 120)
  },
  {
    "name": "Deepening",
    "wpm": 100,
    "wordLimit": Math.floor((duration * 0.4) * 100)
  },
  {
    "name": "Suggestion",
    "wpm": 110,
    "wordLimit": Math.floor((duration * 0.3) * 110)
  },
  {
    "name": "Emergence",
    "wpm": 130,
    "wordLimit": Math.floor((duration * 0.15) * 130)
  }
];

let initial_messages = [];
let audioStorage = {}
let formData = {};

// Middleware setup
app.use(cors());
app.options('*',cors()); //allow all cors
var allowCrossDomain = function(req,res,next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();  
}
app.use(allowCrossDomain); //allow all cors
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '500mb',
  extended: true
}));
app.use(express.static(path.join(__dirname, 'public')));

// Route Handlers
app.get('/audio-stream', handleAudioStream);
app.post('/store-audio', handleStoreAudio);
app.post('/askGPT4-:id', handleGPT4Request);

async function handleAudioStream(req, res) {
  console.log("Current Audio Storage Status"); // Log the current audio storage status
  const storedAudioData = audioStorage['hypnosisAudio'];

  if (storedAudioData) {
    const audioBuffer = Buffer.from(storedAudioData, 'base64');
    const audioStream = new Readable();
    audioStream.push(audioBuffer);
    audioStream.push(null);

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg'
    });
    audioStream.pipe(res);
  } else {
    console.error("No audio found in storage."); // Log an error if no audio is found
    res.status(404).send("Audio not found");
  }
}

async function handleStoreAudio(req, res) {
  console.log("Inside /store-audio");
  const audioData = req.body.audioData;

  if (audioData) {
    audioStorage['hypnosisAudio'] = audioData;
    console.log("Just stored audio data: ", !!audioStorage['hypnosisAudio']);
    res.status(200).send("Audio stored successfully");
  } else {
    console.log("Bad request: Missing audio data");
    res.status(400).send("Bad request: Missing audio data");
  }
}

async function handleGPT4Request(req, res) {
  const userInput = req.body.text;
  formData[`askGPT4-${req.params.id}`] = userInput;
  initial_messages.push({
    "role": "user",
    "content": userInput
  });

  if (initial_messages.length === 4) {
    try {
      await generateHypnosisScript(res);
    } catch (error) {
      console.error("Error in generateHypnosisScript:", error);
      res.status(500).json({
        error: "Internal Server Error"
      });
    }
  } else {
    res.json({
      status: "Form data received. Awaiting other forms."
    });
  }
}

async function generateHypnosisScript(res) {
  try {
    console.log("Entering generateHypnosisScript function...");
    let combinedScript = [];
    let soundInstructions = [];
    let messages = [...initial_messages];

    console.log("Form data received:", formData);

    const issueOrGoal = formData['askGPT4-1'];
    const joyExperiences = formData['askGPT4-2'];
    const personalImagery = formData['askGPT4-3'];
    const coreValues = formData['askGPT4-4'];

    let totalWordLimit = steps.reduce((total, step) => total + step['wordLimit'], 0);

    let prompt_content = `Create a ${totalWordLimit}-word hypnosis script for ${issueOrGoal}.
    Start with ${steps[0]['wordLimit']} words on breathwork, transitioning to facial and limb relaxation.
    In ${steps[1]['wordLimit']} words, guide user to explore walk around, explore, and listen to the sounds within ${joyExperiences}. Pose questions for self-imagination, and emotionally connect with ${personalImagery}.
    Refocus on ${issueOrGoal} in ${steps[2]['wordLimit']} words, using ${personalImagery} and relevant future pacing or symbolism for resolution and align with ${coreValues}.
    Conclude in ${steps[3]['wordLimit']} words, first recalling wins from the Suggestion phase, then countdown to full awareness with sensory elements. End with eye opening.
    Maintain flow. Be specific for common ${joyExperiences} and ${coreValues}. Generalize unique ${issueOrGoal} and ${personalImagery} for immersion.`;

    let user_message = {
      "role": "user",
      "content": prompt_content
    };

    messages.push(user_message);

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: messages,
        max_tokens: 8000
      })
    });

    let data = await response.json();
    console.log("Received response from GPT-3.5:", data);

    if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      let gpt3_5Output = data.choices[0].message.content;

      const gpt4Instructions = `Enhance this hypnosis script by focusing on clarity, professionalism, and overall effectiveness.
      Correct any grammatical errors and provide clear instructions to improve emotional engagement and impact.
      Omit commentary or disclaimers and focus only on the hypnosis script. Ensure the script has around ${totalWordLimit} words`
      const gpt4Prompt = `${gpt4Instructions}\n\n${gpt3_5Output}`;

      response = await fetch('https://api.openai.com/v1/chat/completions', { // Replace with the actual GPT-4 API endpoint
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo-16k",
          messages: [{
            "role": "user",
            "content": gpt4Prompt
          }],
          max_tokens: 12000
        })
      });

      data = await response.json();
      console.log("Received response from GPT-4:", data);

      try {
        if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
          let gpt4Output = data.choices[0].message.content;
          const mainScript = gpt4Output.replace(/\[Background music: [^\]]+\]/g, '');
          const soundInstruction = gpt4Output.match(/\[Background music: [^\]]+\]/g);

          if (soundInstruction) {
            soundInstructions.push(...soundInstruction);
          }

          combinedScript.push(mainScript);
          let ssmlScript = combinedScript.map((script) => {
            return insertSSMLTags(script);
          });
          //const ssmlAudioData = await textToAudioBase64(ssmlScript.join(''));
          const Paragraphs = ssmlScript[0].split('\n'); //split the script in smaller chunks
          
          let ssmlAudioDataDecoded
          for (const para of Paragraphs) { //to use SDK for TTS in small chunks
            var tempBase64 = await textToAudioBase64(para);
            ssmlAudioDataDecoded = ssmlAudioDataDecoded + atob(tempBase64);
          };
          const ssmlAudioData = btoa(ssmlAudioDataDecoded); //re-encode the audiodata to base64
          

          messages.push({
            "role": "assistant",
            "content": gpt4Output
          });

          if (messages.length > 6) {
            messages.shift();
            messages.shift();
          }

          console.log("About to generate audio...");

          if (ssmlAudioData) {
            const postData = JSON.stringify({
              audioData: ssmlAudioData
            });

            const options = {
              hostname: 'hyppoai.eastasia.cloudapp.azure.com',
              port: process.env.PORT || 3000,
              path: '/store-audio',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              }
            };

            const req = http.request(options, (res) => {
              let data = '';

              res.on('data', (chunk) => {
                data += chunk;
              });

              res.on('end', () => {
                console.log('Audio stored:', data);
              });
            });

            req.on('error', (error) => {
              console.error('Error storing audio:', error);
            });

            req.write(postData);
            req.end();
          }

          console.log("Generated Base64 Audio: ", ssmlAudioData.length);
          console.log("About to store audio data: ", !!ssmlAudioData);
          console.log("Is this a Base64 String?", Buffer.from(ssmlAudioData, 'base64').toString('base64') === ssmlAudioData);

          if (!ssmlAudioData) {
            console.error("Base64 Audio data is empty");
          }

          res.json({
            script: ssmlScript,
            audioData: ssmlAudioData,
            soundInstructions: soundInstructions
          });

          initial_messages = [];
          console.log("Sent response with combined script");
          console.log('Base64 Audio:', ssmlAudioData.length);

        } else {
          throw new Error("Unexpected API response");
        }

      } catch (error) {
        console.error("Failed to Generate Script:", error);
      }
    }
  } catch (error) {
    console.error("Error in generateHypnosisScript:", error);
    res.status(500).json({
      error: "Internal Server Error"
    });
  }
}

function insertSSMLTags(text) {
  let modifiedText = text;

  const imaginationKeywords = ['feel', 'visualize', 'imagine', 'breathe', 'Feel', 'Visualize', 'Imagine', 'Breathe', 'breath', 'Breath'];
  const deepReflectionKeywords = ['how', 'How', 'ask', 'Ask', 'What', 'what', 'Picture', 'picture', 'let', 'Now', 'now', 'Allow', 'allow', 'Embrace', 'embrace', 'Envision', 'envision'];
  const longBreakKeywords = ['conclude', 'Conclude', 'end', 'End','near'];

  imaginationKeywords.forEach((keyword) => {
    const pattern = new RegExp(`${keyword}[^.]*\\.`);
    modifiedText = modifiedText.replace(pattern, (matched) => {
      return matched + '<break time="7500ms"/>';
    });
  });

  deepReflectionKeywords.forEach((keyword) => {
    const pattern = new RegExp(`${keyword}[^.]*\\.`);
    modifiedText = modifiedText.replace(pattern, (matched) => {
      return matched + '<break time="15000ms"/>';  // Longer pause for deeper reflection
    });
  });

  longBreakKeywords.forEach((keyword) => {
    const pattern = new RegExp(`${keyword}[^.]*\\.`);
    modifiedText = modifiedText.replace(pattern, (matched) => {
      return matched + '<break time="5000ms"/>';
    });
  });

  return modifiedText;
}

async function textToAudioBase64(text) {
  return new Promise((resolve, reject) => {
    console.log("Input text to generate audio:", text);
    const speechConfig = sdk.SpeechConfig.fromSubscription('c102b5f71e974ec9adcce6029021258d', 'eastus');
    speechConfig.speechSynthesisOutputFormat = 5;

    const audioConfig = sdk.AudioConfig.fromDefaultSpeakerOutput();
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const ssmlText = `<speak version='1.0' xmlns:mstts='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name="en-US-JaneNeural" leadingsilence-exact="3s" sentenceboundarysilence-exact="2.7s" commasilence-exact="900ms" semicolonsilence-exact="450ms">
    <mstts:express-as style='whispering'><prosody rate='-17.00%' volume='-15.00%'>${text}</prosody></mstts:express-as></voice></speak>`;
    console.log("Generated SSML");

    synthesizer.speakSsmlAsync(
      ssmlText,
      result => {
        console.log("Synthesizer Completed");
        if (result && (result.privErrorDetails === null || typeof result.privErrorDetails === 'undefined')) {

          const audioDataBuffer = Buffer.from(result.privAudioData);
          const audioBase64 = audioDataBuffer.toString('base64');
          resolve(audioBase64);

        } else {
          reject(new Error(`Synthesis failed: ${result.privErrorDetails}`));
        }
      },
      error => {
        console.error("Synthesizer Error:", error);
        synthesizer.close();
        reject(error);
      }
    );
  });
}


app.listen(PORT, () => {
  console.log(`Server is running on http://hyppoai.eastasia.cloudapp.azure.com:${PORT}`);
});
