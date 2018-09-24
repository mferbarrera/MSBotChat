/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var randtoken = require('rand-token');
var timeout = require('botbuilder-timeout');

const appInsights = require("applicationinsights");
appInsights.setup("c311c581-21a6-4df2-9cad-ebcdc30f6d08");
appInsights.start();

const {createDatetimePrompt} = require('botbuilder-prompts');
const stringSimilarity = require('string-similarity');
const printf = require('printf');

const timePrompt = createDatetimePrompt;

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rissobot@gmail.com',
        pass: 'R1550Bot'
    }   
});

const fs = require('fs');
const path = require('path');
const util = require('util');
const options = {
    PROMPT_IF_USER_IS_ACTIVE_MSG: "¿Continuas por acá?",
    PROMPT_IF_USER_IS_ACTIVE_BUTTON_TEXT: "Si",
    PROMPT_IF_USER_IS_ACTIVE_TIMEOUT_IN_MS: 60000,
    END_CONVERSATION_MSG: "Fue un gusto saludarte, hasta la próxima",
    END_CONVERSATION_TIMEOUT_IN_MS: 15000
};

const knowledgedb = [
    {
        'confirm' : 'instalación de software', 
        'validate' : true, 
        'answer' : 'Hola, ingresa a http://appstore.progreso.com/ para ver el catálogo de software que puedes instalar. Si no está en el catálogo, llama al Centro de Soluciones (extensión 9911) y con gusto te apoyarán.', 
        'options' : ['Cómo puedo instalar software', 'Necesito instalar software', 'Necesito instalar', 'Como puedo instalar'], 
        'form' : [], 
        'choices' : [], 
        'mail' : false
    }, 
    {
        'confirm' : 'liberar un correo detenido', 
        'validate' : true, 
        'answer' : 'Hola, entra a http://micorreo.cempro.com, ingresa tu usuario (correo electrónico) y contraseña y escoge el correo que quieres liberar. Si necesitas apoyo, llama al Centro de Soluciones TI (extensión 9911) y con gusto de apoyarán.', 
        'options' : ['Cómo liberar un correo detenido', 'no me llegan los correos', 'liberar correos detenidos', 'correo detenido', 'correo'], 
        'form' : [], 
        'choices' : [], 
        'mail' : false
    }, 
    {
        'confirm' : 'modificar accesos a SAP', 
        'validate' : true, 
        'answer' : 'Hola, llena el formulario "Acceso a transacciones SAP" con los datos correspondientes (usuario, jefe inmediato, transacciones, etc.) y envíalo a centrodesolucionesti@cempro.com en dónde un agente del Centro de Soluciones TI con gusto te apoyará.', 
        'options' : ['modificar accesos a SAP', 'transacciones SAP', 'SAP'], 
        'form' : [], 
        'choices' : [], 
        'mail' : false
    }, 
    {
        'confirm' : 'acceso a internet para consultores', 
        'validate' : true, 
        'answer' : 'Hola, con gusto puedo apoyarte. Por favor, ingresa la siguiente información:', 
        'options' : ['Cómo puedo solicitar acceso a internet para consultores', 'Cómo puedo tramitar acceso a internet para consultores', 'acceso a internet para consultores'], 
        'form' : ['Nombre del consultor', 'Correo del consultor', 'Qué día inicia el acceso?', 'Qué día finializa el acceso?'], 
        'choices' : [], 
        'mail' : true
    }, 
    {
        'confirm' : 'visitar sitio Wiki', 
        'validate' : true, 
        'answer' : 'Hola, puedes visitar el Wiki Colabora de KM en https://jam4.sapjam.com/groups/CfcWFCCve08rIQIlqTVDny/overview_page/PF7FtDFBoMNkdXgW1mQHEI', 
        'options' : ['Tenemos un Wiki', 'Como puedo acceder al sitio Wiki', 'Hay un Wiki Privado', 'Wiki'], 
        'form' : [], 
        'choices' : [], 
        'mail' : false
    }, 
    {
        'confirm' : 'soporte de impresión', 
        'validate' : true, 
        'answer' : 'Necesito soporte de impresión', 
        'options' : ['acceso a impresora', 'no imprime', 'cambio toner'], 
        'form' : [], 
        'choices' : ['Darme acceso a una impresora', 'Cambio de toner'], 
        'mail' : false
    }, 
    {
        'confirm' : 'acceso a una impresora', 
        'validate' : false, 
        'answer' : '', 
        'options' : ['Darme acceso a una impresora'], 
        'form' : ['A qué impresora necesitas acceso?'], 
        'choices' : [], 
        'mail' : true
    }, 
    {
        'confirm' : 'cambio de toner', 
        'validate' : false, 
        'answer' : '', 
        'options' : ['Cambio de toner'], 
        'form' : ['A qué impresora necesitas que se le cambie toner?'], 
        'choices' : [], 
        'mail' : true
    }
];

var vacationformtoken='';
var equformtoken='';
var loanformtoken='';

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service

var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);
timeout.setConversationTimeout(bot,options);

bot.dialog('/', [
    function (session) {
        session.preferredLocale('es', function (err) {
            console.log(err);
        });
        builder.Prompts.choice(session, "¡Hola! Soy Timi, tu asistente virtual. ¿Cómo puedo ayudarte?",['Resolver consultas','Formularios','Información','Reiniciar tu contraseña'],{listStyle:3});
    },
    function (session, results) {
        switch (results.response.index) {
            case 0:
                session.beginDialog('/consultas',{'skipprompt':false,'initprompt':''});
                break;
            case 1:
                session.beginDialog('/formularios');
                break;
            case 2:
                session.beginDialog('/informacion');
                break;
            case 3:
                session.beginDialog('/reinicioclave');
                break;
            default:
                session.endDialog();
                break;
        }
    },
    function (session) {
        // Reload Menu
        session.replaceDialog('/');
    }
]);

// Formularios

bot.dialog('/formularios', [
    function (session) {
        builder.Prompts.choice(session, "Excelente, puedo ayudarte con estos formularios:",['Acceso carpetas Calendar, Grupo de Distribución, etc.','Acceso transacciones SAP','Acceso carpeta pública','Regresar'],{listStyle:3});
    },
    function (session, results) {
        switch (results.response.index) {
            case 0:
                session.beginDialog('/formulario_acceso_carpetas');
                break;
            case 1:
                session.beginDialog('/formulario_acceso_transacciones_sap');
                break;
            case 2:
                session.beginDialog('/formulario_acceso_carpetas_publicas');
                break;
            case 3:
                session.replaceDialog('/');
                break;
            default:
                session.endDialog();
                break;                        
        }
    },
    function (session) {
        session.replaceDialog('/');
    }
]);

// Formulario de vacaciones

bot.dialog('/formulario_vacaciones', [
    function (session) {
        builder.Prompts.time(session, "De acuerdo, llenemos el formulario de tus vacaciones. ¿Cúando deseas iniciar tu periodo vacacional? (Utiliza un formato numerico dia/mes/año, por ejemplo 15/08/2018)");
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.startdate=results.response;
            builder.Prompts.time(session, "Y... ¿Cúando regresas a laborar?");
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.enddate=results.response;
            builder.Prompts.text(session,"Perfecto, necesitamos nos brindes una justificación o referencia");
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.justify=results.response;
        }
        
        if (session.dialogData.startdate && session.dialogData.enddate && session.dialogData.justify) {
            session.dialogData.valid=true;
            var token = randtoken.generate(8);
            vacationformtoken=token;
            session.dialogData.vacationformtoken=token;
            session.send("El formulario ha sido creado exitosamente, su número de referencia es: "+token+"; recuerda que solo te quedan 12 días de vacaciones disponibles");
        } else {
            session.dialogData.valid=false;
            session.send("No se pudo crear el formulario, no logre recolectar la información necesaria");
            session.endDialogWithResult({response: {vacationformtoken:token}});
        }
        builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

bot.dialog('/formulario_acceso_carpetas', [
    function (session) {
        session.send('Acá esta el formulario que debes llenar, para obtener acceso a la carpeta de Calendar, Grupo de Distribución en Outlook y cuenta de correo')        
        fs.readFile('./formularios/acceso_carpeta_calendar_grupo_de_distribución_en_outlook_y_cuenta_de_correo.jpg',function (err, data) {
            var contentType = 'image/jpg';
            var base64 = new Buffer.from(data).toString('base64');
     
            var msg = new builder.Message(session)
                .addAttachment({
                    contentUrl: util.format('data:%s;base64,%s', contentType, base64),
                    contentType: contentType,
                    name: 'Acceso a carpeta de Calendar, Grupo de Distribución en Outlook y cuenta de correo.xlsm'
                });
        
            session.send(msg);
            builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
        });
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

bot.dialog('/formulario_acceso_transacciones_sap', [
    function (session) {
        session.send('Acá esta el formulario que debes llenar, para obtener acceso transacciones SAP')        
        fs.readFile('./formularios/acceso_a_transacciones_de_sap.jpg',function (err, data) {
            var contentType = 'image/jpg';
            var base64 = new Buffer.from(data).toString('base64');
            var msg = new builder.Message(session)
                .addAttachment({
                    contentUrl: util.format('data:%s;base64,%s', contentType, base64),
                    contentType: contentType,
                    name: 'Acceso a transacciones de SAP.xlsm'
                });
        
            session.send(msg);
            builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
        });
         
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

bot.dialog('/formulario_acceso_carpetas_publicas', [
    function (session) {
        session.send('Acá esta el formulario que debes llenar, para obtener acceso a las carpetas públicas')        
        fs.readFile('./formularios/acceso_a_carpetas_publicas.jpg',function (err, data) {
            var contentType = 'image/jpg';
            var base64 = new Buffer.from(data).toString('base64');
            var msg = new builder.Message(session)
                .addAttachment({
                    contentUrl: util.format('data:%s;base64,%s', contentType, base64),
                    contentType: contentType,
                    name: 'Acceso a carpetas públicas.xlsm'
                });
        
            session.send(msg);
            builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
        });
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

bot.dialog('/formulario_prestamo_equipo', [
    function (session) {
        builder.Prompts.choice(session, "De acuerdo, llenemos el formulario del prestamo de equipo ¿En que equipo estas interesado?",['Proyector','Telefono','Laptop'],{listStyle:3});
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.equ=results.response;
            builder.Prompts.time(session, "¿Cúando deseas utilizarlo?");
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.startdate=results.response;
            builder.Prompts.time(session,"¿Cúando dejaras de utilizarlo?");
        } else {
            next();
        }
    },
        function (session, results, next) {
        if (results.response) {
            session.dialogData.enddate=results.response;
            builder.Prompts.text(session,"¿Para que lo utilizarás?");
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.justify=results.response;
        }
        
        if (session.dialogData.startdate && session.dialogData.enddate && session.dialogData.justify && session.dialogData.equ) {
            session.dialogData.valid=true;
            var token = randtoken.generate(8);
            session.dialogData.equformtoken=token;
            equformtoken=token;
            session.send("El formulario ha sido creado exitosamente, su número de referencia es: "+token);
        } else {
            session.dialogData.valid=false;
            session.send("No se pudo crear el formulario, no logre recolectar la información necesaria");
            session.endDialog();
        }
        builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

bot.dialog('/formulario_prestamo_asociacion', [
    function (session) {
        builder.Prompts.number(session, "De acuerdo, llenemos el formulario del prestamo de la asociación ¿En que monto estas interesado?");
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.Q=results.response;
            builder.Prompts.number(session, "¿En cuantos meses deseas realizar el prestamo?");
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.N=results.response;
            builder.Prompts.choice(session,"¿Para qué utilizaras el préstamo?",['Construcción','Consolidar deudas','Salud','Viajes','Otros'], {listStyle:3} );
        } else {
            next();
        }
    },
    function (session, results) {
        if (results.response) {
            session.dialogData.justify=results.response;
        }
        
        if (session.dialogData.Q && session.dialogData.N) {
            var r = 0.36/12;
            var Q = session.dialogData.Q;
            var N = session.dialogData.N;
            var S = Q*r*Math.pow(1+r,N)/(Math.pow(1+r,N)-1);
            session.dialogData.S=S;
            builder.Prompts.confirm(session,printf("La cuota a %d meses es de %.2f, si esta de acuerdo seleccione si, si desea calcular de nuevo selecciones no",N,S));
        }
    },
    function (session, results) {
        if (!results.response) {
            session.replaceDialog('/formulario_prestamo_asociacion');
        }
        
        if (session.dialogData.justify) {
            session.dialogData.valid=true;
            var token = randtoken.generate(8);
            loanformtoken=token;
            session.dialogData.loanformtoken=token;
            session.send("El formulario ha sido creado exitosamente, su número de referencia es: "+token);
        } else {
            session.dialogData.valid=false;
            session.send("No se pudo crear el formulario, no logre recolectar la información necesaria");
            session.endDialog();
        }
        builder.Prompts.confirm(session, "Desea ingresar otro formulario?");
    },
    function (session,results) {
        if (results.response) {
            session.replaceDialog('/formularios');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

// Información

bot.dialog('/informacion', [
    function (session) {
        builder.Prompts.choice(session, "Hola, entiendo que deseas información, puedo ayudarte con:",['Estado de solicitudes a RRHH','Estado de solicitud de prestamo','Dejar un comentario','Regresar'],{listStyle:3});
    },
    function (session, results) {
        switch (results.response.index) {
            case 0:
                session.beginDialog('/informacion_rrhh');
                break;
            case 1: 
                session.beginDialog('/informacion_prestamo');
                break;
            case 2: 
                session.beginDialog('/comentario');
                break;    
               
            case 3:
                session.beginDialog('/');
                break;
            default:
                session.endDialog();
                break;                        
        }
    },
    function (session) {
        session.replaceDialog('/');
    }
]);

bot.dialog('/informacion_rrhh', [
    function(session) {
        var n=0
        if (session.dialogData.vacationformtoken) n+=1;
        if (session.dialogData.equformtoken) n+=1;
        if (n==0) {
            session.send("Actualmente no tienes solicitudes de RRHH pendientes");          
        } else {
            session.send("Tienes "+n+" solicitudes pendientes:");
            if (vacationformtoken) session.send("Solicitud de vacaciones: "+session.dialogData.vacationformtoken);
            if (equformtoken) session.send("Solicitud de equipos:"+session.dialogData.equformtoken);
        }
        builder.Prompts.confirm(session, "Deseas realizar otra consulta?");
    },
    function(session,results) {
        if (results.response) {
            session.replaceDialog('/informacion')
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    } 
]); 

bot.dialog('/informacion_prestamo', [
    function(session) {
        if (loanformtoken) {
            session.send("Tienes una solicitud de prestamo:"+session.dialogData.loanformtoken+", actualmente esta en la etapa de: Evaluación financiera");
        } else {
            session.send("No tienes solicitudes de prestamo");
        }
        builder.Prompts.confirm(session,"Deseas realizar otra consulta?");
    },
    function(session,results) {
        if (results.response) {
            session.replaceDialog('/informacion');
        } else {
            session.send("Fue un gusto ayudarte, hasta la próxima");
            session.endDialog();
        }
    }
]);

// Comentario
bot.dialog('/comentario', [
   function(session) {
       builder.Prompts.text(session, "Tus comentarios son muy importante para nosotros, puedes dejar tus comentarios para mejoras");
   },
   function(session, results, next) {
       if (results.response) {
           var mailOptions = {
              from: 'robot@rissotechnologies.com',
              subject: 'Comentario',
              text: results.response
           };
           var maillist = [
               'mferbarrera@gmail.com',
               'luis.rios@rissotechnologies.com'
           ];
           maillist.forEach(function(to,i,array) {
                mailOptions.to=to;
                
                transporter.sendMail(mailOptions, function(error, info){
                   if (error) {
                    console.log(error);
                   } else {
                    console.log('Email sent: ' + info.response);
                   }
                });
           });
           
           session.send("Gracias, recibimos tu comentario y estaremos poniendonos en contacto contigo");
       }
       session.replaceDialog('/');
   }
]);

// Reinicio de clave

bot.dialog('/reinicioclave', [
   function(session) {
       builder.Prompts.text(session, "¿Cúal es tu usuario?");
   },
   function(session, results, next) {
       var token = randtoken.generate(8);
       if (results.response) {
           console.log(results.response);
           var username=results.response;
           if (/>.+</.exec(username)) {
               username=/>.+</.exec(username)[0].replace(">","").replace("<","");            
           }
           var mailOptions = {
              from: 'robot@rissotechnologies.com',
              subject: 'Cambio de contraseña',
              text: 'Se ha solicitado un cambio de cotraseña para el usuario: ' +username+'\nTu nueva contraseña asignada es: '+token
           };
           var maillist = [
               'mferbarrera@gmail.com',
               'luis.rios@rissotechnologies.com'           
           ];
           maillist.forEach(function(to,i,array) {
                mailOptions.to=to;
                
                transporter.sendMail(mailOptions, function(error, info){
                   if (error) {
                    console.log(error);
                   } else {
                    console.log('Email sent: ' + info.response);
                   }
                });
           });
           
           session.send("Te hemos enviado un correo con tu nueva contraseña.");
       }
       session.replaceDialog('/');
   }
]);



// Consultas

function getFromKnowledge(question) {
    stringMatch=0;
    jsonAnswer={}
    knowledgedb.forEach(function(knowledge) {
        knowledge.options.forEach(function(option) {
            var stringCompare=stringSimilarity.compareTwoStrings(question.toLowerCase(),option.toLowerCase());
            if ((stringCompare>stringMatch && knowledge.validate) || (stringCompare==1 && !knowledge.validate)) {
                stringMatch=stringCompare;
                jsonAnswer=knowledge;
            }
        });
    });
    jsonAnswer.match=stringMatch;
    return jsonAnswer;
}

function sendMail(jsonform) {
    var mailText = "";
    jsonform.answer.forEach(function(item) {
        mailText+=item.key+" : "+item.response+"\n"
    });

    var mailOptions = {
              from: 'robot@rissotechnologies.com',
              subject: jsonform.subject,
              text: mailText
           };

    var maillist = [
       'mferbarrera@gmail.com',
       'luis.rios@rissotechnologies.com'
    ];

    maillist.forEach(function(to,i,array) {
        mailOptions.to=to;
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    });
}


bot.dialog('/consultas', [
    function(session, args, next) {
        console.log(args);
        if (args) {
            session.dialogData.args=args;
        }
        if (!args.skipprompt) {
            if (!args.initprompt) {
                args.initprompt='Cuentame, ¿cómo puedo apoyarte?';
            }
            builder.Prompts.text(session,args.initprompt);
        } else {
            next();
        }
    },
    function(session,results,next) {
        args=session.dialogData.args;
        var question
        if (args.skipprompt) {
            question=args.question;
        } else {
            question=results.response;
        }
        session.dialogData.args={};
        var matchAnswer = getFromKnowledge(question);
        session.dialogData.matchAnswer=matchAnswer;
        if (matchAnswer.validate) {
            builder.Prompts.choice(session,"Tu consulta es como "+matchAnswer.confirm,['Si','No','Regresar'],{listStyle:3});
        } else {
            next();
        }
    },
    function(session,results,next) {
        var matchAnswer = session.dialogData.matchAnswer;
        if (matchAnswer.validate) {
            switch (results.response.index) {
                case 1:
                    console.log(results.response);
                    console.log("No funciono el bot...");
                    var args = {
                        skipprompt: false,
                        initprompt: 'Quiero apoyarte, podriamos intentar nuevamente, podrías indicar mas terminos relacionados a tu consulta? (por ejemplo, no puedo imprimir o salen manchas de toner en mi impresión)'
                    };
                    console.log(args);
                    session.replaceDialog('/consultas',args);
                    break;
                case 2:
                    console.log(results.response);
                    console.log("Se desespero el usuario...");
                    session.replaceDialog('/');
                    break;
                default:
                    next();
                    break;
            }
        } else {
            next();
        }
    },
    function(session,results,next) {
        var matchAnswer = session.dialogData.matchAnswer;
        if (matchAnswer.choices.length) {
            builder.Prompts.choice(session,"Asi que deseas saber como "+matchAnswer.answer+" especificamente en:",matchAnswer.choices,{listStyle:3});
        } else {
            next();
        }
    },
    function(session,results,next) {
        var matchAnswer = session.dialogData.matchAnswer;
        if (matchAnswer.choices.length) {
            var args = {'question': results.response.entity, 'initprompt': '', 'skipprompt': true};
            session.replaceDialog('/consultas',args);
        } else {
            next();
        }
    },
    function(session,results,next) {
        var matchAnswer = session.dialogData.matchAnswer;
        if (matchAnswer.form.length) {
            var args = {
                subject: "Consultan como " + matchAnswer.confirm,
                prompts: matchAnswer.form,
                answer : [],
                mail   : matchAnswer.mail
            }
            session.beginDialog('/fillform',args);
        } else {
            next();
        }
    },
    function(session) {
        var matchAnswer=session.dialogData.matchAnswer;
        session.send(matchAnswer.answer);
        builder.Prompts.choice(session,'Te puedo ayudar en otra consulta?',['Si','No'],{listStyle:3});
    },
    function(session,results) {
        if (results.response.index==0) {
            var args = {
                'skipprompt' : false,
                'initprompt' : ''
            };
            session.replaceDialog('/consultas',args);
        } else {
            session.replaceDialog('/');
        }
    }
]);

bot.dialog('/fillform',[
    function(session,args) {
        session.dialogData.args=args;
        builder.Prompts.text(session,args.prompts[0]);
    },
    function(session,results) {
        session.dialogData.args.answer.push({'key':session.dialogData.args.prompts[0],'response':results.response});
        session.dialogData.args.prompts.splice(0,1);
        if (session.dialogData.args.prompts.length) {
            var args = session.dialogData.args;
            session.replaceDialog('/fillform',args);
        } else {
            if (session.dialogData.args.mail) {
                sendMail(session.dialogData.args);    
            }
            session.send("Gracias, nos estaremos poniendo en contacto pronto");
            session.endDialog();
        }
    }
]);