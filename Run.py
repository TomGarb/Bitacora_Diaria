import os
from App import create_app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '127.0.0.1')
    debug = os.getenv('FLASK_DEBUG', '1') == '1'
    
    print("=" * 65)
    print(" 🚀 INICIANDO BITÁCORA DE CENTRO DE OPERACIONES (DOC)")
    print(f" 🌐 Servidor activo en: http://{host}:{port}")
    print(f" ⚙️  Modo Debug: {debug}")
    print("=" * 65)
    
    app.run(host=host, port=port, debug=debug)
