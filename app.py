from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from time import sleep

driver = webdriver.Chrome()
driver.get("https://web.whatsapp.com")

print("Escaneie o QR Code e pressione ENTER")
input()

receitas = 0
despesas = 0
ultima_msg = ""

while True:
    try:
        print("Buscando mensagens...")

        mensagens = driver.find_elements(By.XPATH, "//span[@dir='ltr']")

        print(f"Mensagens encontradas: {len(mensagens)}")

        if mensagens:
            texto = mensagens[-1].text.lower()
            print("Última mensagem:", texto)

            if texto != ultima_msg:
                ultima_msg = texto

                if texto.startswith("receita"):
                    valor = int(texto.split()[1])
                    receitas += valor
                    resposta = f"✅ Receita: R${valor}"

                elif texto.startswith("despesa"):
                    valor = int(texto.split()[1])
                    despesas += valor
                    resposta = f"💸 Despesa: R${valor}"

                elif texto == "saldo":
                    saldo = receitas - despesas
                    resposta = f"💰 Saldo: R${saldo}"

                else:
                    print("Mensagem ignorada")
                    sleep(2)
                    continue

                print("Enviando resposta...")

                caixas = driver.find_elements(By.XPATH, "//div[@contenteditable='true']")

                if caixas:
                    caixa = caixas[-1]
                    caixa.click()
                    caixa.send_keys(resposta)
                    caixa.send_keys(Keys.ENTER)
                    print("Resposta enviada!")
                else:
                    print("❌ Não encontrou caixa de mensagem")

        sleep(3)

    except Exception as e:
        print("ERRO:", e)
        sleep(3)