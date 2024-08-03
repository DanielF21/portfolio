import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import scheme_interp
from io import StringIO
import sys
import traceback

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this will be the same as the frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SchemeInput(BaseModel):
    input: str

# Global frame for the REPL
global_frame = None

@app.on_event("startup")
async def startup_event():
    global global_frame
    global_frame = scheme_interp.Frame(scheme_interp.builtin_frame)
    logger.info("Initialized global frame")

@app.post("/scheme-interpreter")
async def scheme_interpreter(scheme_input: SchemeInput):
    global global_frame
    logger.info(f"Received input: {scheme_input.input}")
    
    # Capture stdout
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    
    try:
        inp = scheme_input.input.strip()
        if inp.lower() == "exit":
            return {"output": "bye bye!\n"}

        # Tokenize and parse the input
        tokens = scheme_interp.tokenize(inp)
        ast = scheme_interp.parse(tokens)
        
        # Evaluate the expression
        args = [ast]
        if global_frame is not None:
            args.append(global_frame)
        result, global_frame = scheme_interp.result_and_frame(*args)
        
        # Get the captured output
        output = sys.stdout.getvalue()
        logger.info(f"Evaluation result: {result}")
        logger.info(f"Captured output: {output}")
        
        # Remove any "in>" prompts from the captured output
        output_lines = output.splitlines()
        cleaned_output = "\n".join(line for line in output_lines if not line.strip().startswith("in>"))
        
        # Construct the response
        response = f"{cleaned_output}"
        if result is not None:
            response += f"out> {result}\n"
        
        return {"output": response}
    except scheme_interp.SchemeError as e:
        logger.error(f"SchemeError: {e}")
        return {"output": f"{e.__class__.__name__}: {e}\n"}
    except Exception as e:
        logger.error(f"Error in scheme_interpreter: {e}")
        logger.error(traceback.format_exc())
        return {"output": f"Error: {str(e)}\n"}
    finally:
        # Restore stdout
        sys.stdout = old_stdout

@app.get("/")
async def root():
    return {"message": "Scheme interpreter server is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
