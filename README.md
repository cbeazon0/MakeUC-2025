# Welcome to 'Drawn to Chaos'!

**Drawn to Chaos** is a fast-paced, competitive, free-for-all digital _Pictionary_-style game where players use their webcams to draw random images, then earn points by guessing others' drawings quickly and correctly

## How Can I Play?

Follow the steps below to clone the repo and get started!

### Prerequisites

Please install the following:

- Git: [Install Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- Python: [3.10.x](https://www.python.org/downloads/) (Tested on 3.10.11)
- Node.js: [Install Node.js](https://nodejs.org/en/download)

### Clone the repository

Clone the repository into a directory of your choice:

```
git clone https://github.com/cbeazon0/MakeUC-2025.git
```

### Create and activate a virtual environment (Python)

Verify python version (make sure it shows 3.10.x):

```
python --version
```

Windows:

```
python -m venv venv
.\venv\Scripts\activate
```

Linux/macOS:

```
python -m venv venv
source venv/bin/activate
```

### Install dependencies (Python)

```
cd backend
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

### Install dependencies (Node)

```
cd frontend
npm i
```

### Running the game locally

While in the frontend directory, run the following command:

```
npm run dev
```

Control click on the 'localhost' webpage and enable camera access

In a new terminal, navigate to the backend directory and run the following command

```
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Now your local host window should be set up to play!
