import qrcode
import io
import random
import string
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY"),
)

def generate_session_code(length = 6):
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace('O', '').replace('0', '').replace('1', '').replace('I', '')
    return ''.join(random.choices(chars, k=length))

def generate_qr_code(session_code, base_url="http://localhost:3000"):
    """
    Generates a QR code image for a game session

    :param session_code: unique session code
    :param base_url: will ultimately be URL for the join link
    :return: tuple: (qr_code_url, buffer) - URL used to store QR code and image buffer
    """
    join_url = f"{base_url}/join/{session_code}"

    qr = qrcode.QRCode(
        version=1,
        error_correction = qrcode.constants.ERROR_CORRECT_M,
        box_size = 10,
        border = 0,
    )
    qr.add_data(join_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    file_path = f"qr-codes/{session_code}.png"

    try:
        # Upload file
        supabase.storage.from_('qr-codes').upload(
            file_path,
            buffer.getvalue(),
            file_options={"content-type": "image/png"}
        )

        # Get public URL
        qr_code_url = supabase.storage.from_('qr-codes').get_public_url(file_path)

        return qr_code_url, buffer
    except Exception as e:
        print(f"Error uploading QR code: {e}")
        raise

def check_session_code_exists(session_code):
    from supabase_client import supabase as db_client
    result = db_client.table('games').select('session_code').eq('session_code', session_code).execute()
    return len(result.data) > 0