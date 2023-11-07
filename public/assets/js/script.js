let isLoading = false;

function handleFormSubmit(e) {
  if (isLoading) return;
  isLoading = true;

  document.getElementById('js-preloader').classList.remove('loaded');

  console.log("Form submitted");
  e.preventDefault();

  const userInput = e.target.querySelector('textarea').value;
  const endpoint = e.target.getAttribute('data-endpoint');
  const redirectTo = e.target.getAttribute('action');

  console.log("Sending request to endpoint:", endpoint);

  fetch('http://hyppoai.eastasia.cloudapp.azure.com:3000' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: userInput
      })
    })
    .then(response => response.json())
    .then(data => {
      isLoading = false;

      document.getElementById('js-preloader').classList.add('loaded');

      if (data.status === "Form data received. Awaiting other forms.") {
        window.location.href = redirectTo;
      } else if (data.script) {
        sessionStorage.setItem('receivedScript', data.script);

        fetch('http://hyppoai.eastasia.cloudapp.azure.com:3000/audio-stream')
          .then(response => ersponse.blob())
          .then(blob => {
            const audioElement = document.getElementById('audioPlayer')
            audioElement.src = URL.createObjectURL(blob);
          })
          .catch(error => console.error('Error streaming audio:', audio));
        window.location.href = redirectTo;
      } else if (data.error) {
        alert("An error occurred. Please try again");
      }
    })
    .catch(error => {
      isLoading = false;

      document.getElementById('js-preloader').classList.add('loaded');

      console.error("Error fetching response:", error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
  const forms = document.querySelectorAll('.gptForm');
  forms.forEach(form => {
    form.addEventListener('submit', handleFormSubmit);
  });

  // Only on the last page, retrieve and display the stored script
  const displayArea = document.getElementById('gptResponseDisplay');
  const audioElement = document.getElementById('audioPlayer');

  audioElement.onerror = function() {
    console.error('Error in audio playback:', audioElement.error);
  };

  audioElement.onloadeddata = function() {
    console.log('Audio data loaded successfully');
  };

  if (displayArea && audioElement) {
    const storedScript = sessionStorage.getItem('receivedScript');

    if (storedScript) {
      displayArea.textContent = storedScript;
      displayArea.style.display = 'block';
    }

    // Set the audio src to the streaming endpoint
    audioElement.src = 'http://hyppoai.eastasia.cloudapp.azure.com:3000/audio-stream';
    audioElement.style.display = 'block';
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const wordLimit = 70; // Set the word limit here

  // Function to initialize word count for a form
  function initializeWordCount(textAreaId, wordCountId) {
    const textArea = document.getElementById(textAreaId);
    const wordCountDisplay = document.getElementById(wordCountId);

    if (textArea && wordCountDisplay) {
      // Initialize word count display
      wordCountDisplay.textContent = `0/${wordLimit} words`;

      textArea.addEventListener('input', function() {
        const words = this.value.match(/\S+/g);
        const wordCount = words ? words.length : 0;
        wordCountDisplay.textContent = `${wordCount}/${wordLimit} words`;
      });
    }
  }

  // Initialize word count for each form
  initializeWordCount('userInput1', 'wordCount1');
  initializeWordCount('userInput2', 'wordCount2');
  initializeWordCount('userInput3', 'wordCount3');
  initializeWordCount('userInput4', 'wordCount4');
});
