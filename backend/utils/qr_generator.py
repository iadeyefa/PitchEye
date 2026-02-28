import qrcode
import io
import random
import string
from utils.supabase_client import supabase_admin as supabase

def generate_session_code(length = 6):
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace('O', '').replace('0', '').replace('1', '').replace('I', '')
    return ''.join(random.choices(chars, k=length))

def generate_qr_code(session_code, base_url="http://localhost:3000"):
    """
    Generates a QR code image for a game session
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
        supabase.storage.from_('qr-codes').upload(
            file_path,
            buffer.getvalue(),
            file_options={"content-type": "image/png"}
        )

        qr_code_dict = supabase.storage.from_('qr-codes').create_signed_url(
            file_path,
            expires_in=604800  # 7 days
        )

        qr_code_url = qr_code_dict["signedURL"]

        return qr_code_url, buffer
    except Exception as e:
        print(f"Error uploading QR code: {e}")
        raise

def check_session_code_exists(session_code):
    from utils.supabase_client import supabase as db_client
    result = db_client.table('games').select('session_code').eq('session_code', session_code).execute()
    return len(result.data) > 0