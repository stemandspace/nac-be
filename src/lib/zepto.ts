import axios from 'axios';


const ZEPTO_MAIL_API_KEY = 'PHtE6r0PQe++iWMt80VStKSxQMWhZ94nru40f1FC491HAvMHFk1Vq9gslTGzrB0sVaJGF/GTzoxgtuud4ujRd2u7YW9IDWqyqK3sx/VYSPOZsbq6x00csF4dck3aXIXsdddq0CTUvtzeNA==';


const from = {
    address: "noreply@spacetopia.in",
    name: "noreply"
}

interface recipient {
    address: string;
    name: string;
    merge_info: {
        [key: string]: string;
    }
}

export const sendZeptoMail = async (
    mail_template_key: string,
    recipients: recipient[]
) => {

    const to = recipients.map(recipient => ({
        email_address: {
            address: recipient.address,
            name: recipient.name
        },
        merge_info: recipient.merge_info
    }));

    const payload = {
        mail_template_key,
        from,
        to
    }

    try {
        return await axios.post(`https://api.zeptomail.com/v1/mail/batch`, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Zoho-enczapikey ${ZEPTO_MAIL_API_KEY}`
            }
        })
    } catch (error) {
        console.error(error);
        throw error;
    }
}