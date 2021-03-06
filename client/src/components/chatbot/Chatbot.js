import React, { Component } from 'react';
import axios from 'axios/index';
import { withRouter} from 'react-router-dom';


import Cookies from 'universal-cookie';
import { v4 as uuid} from 'uuid';    

import Message from './Message';
import Card from './Card';

import QuickReplies from './QuickReplies';

const cookies = new Cookies();

class Chatbot extends Component {

    messagesEnd;
    talkInput;

    constructor(props) {
        super(props);

        this._handleInputKeyPress = this._handleInputKeyPress.bind(this);
        this._handleQuickReplyPayload = this._handleQuickReplyPayload.bind(this);

        this.hide = this.hide.bind(this);
        this.show = this.show.bind(this);

        this.state = {
            messages: [],
            showBot: true,
            isShop: false,
            shopWelcomeSent: false,
            welcomeSent: false,
            clientToken: false,
            regenerateToken: 0
        };

        if (cookies.get('userID') === undefined) {
            cookies.set('userID', uuid(), { path: '/' });
        }
    }

    async df_text_query (text) {
        let says = {
            speaks: 'yo',
            msg: {
                text: {
                    text: text
                }
            }
        }

        this.setState({messages: [...this.state.messages, says]});
        
        const request = {
            queryInput: {
                text: {
                    text: text,
                    languageCode: 'es-MX',
                },
            }
        };
        await this.df_client_call(request);
    };

    async df_event_query(event) {
        const request = {
            queryInput: {
                event: {
                    name: event,
                    languageCode: 'es-MX',
                },
            }
        };

        await this.df_client_call(request);

    };

    async df_client_call(request) {

        try {
            if (this.state.clientToken === false) {
                const res = await axios.get('/api/get_client_token');
                this.setState({clientToken: res.data.token});
            }

            var config = {
                headers: {
                    'Authorization': "Bearer " + this.state.clientToken,
                    'Content-Type': 'application/json; charset=utf-8' 
                }
            };

            /* const res = await axios.post(
                'https://dialogflow.googleapis.com/v2beta1/projects/' + process.env.REACT_APP_GOOGLE_PROJECT_ID +
                '/agent/sessions/' + process.env.REACT_APP_DF_SESSION_ID + cookies.get('userID') + ':detectIntent',
                request,
                config
            ); */


            const res = await axios.post(
                'https://dialogflow.googleapis.com/v2beta1/projects/' +
                'koverchatbot-thre' +
                '/agent/sessions/' +
                'kover-bot-session' +
                cookies.get('userID') +
                ':detectIntent',
                request,
                config
              );

            let says = {};

            if (res.data.queryResult.fulfillmentMessages ) {
                for (let msg of res.data.queryResult.fulfillmentMessages) {
                    says = {
                        speaks: 'bot',
                        msg: msg
                    }
                    this.setState({ messages: [...this.state.messages, says]});
                }
            }

            this.setState({regenerateToken: 0});

        } catch (e) {
            //console.log(e);
            if (e.response.status === 401 && this.state.regenerateToken < 1) {
                this.setState({ clientToken: false, regenerateToken: 1 });
                this.df_client_call(request);
            }
            else {
                let says = {
                    speaks: 'bot',
                    msg: {
                        text : {
                            text: "Ha ocurrido un problema, volvere mas tarde."}
                    }
                }
                this.setState({ messages: [...this.state.messages, says]});
                let that = this;
                setTimeout(function(){
                    that.setState({ showBot: false})
                }, 2000);
            }
            
        }
    }

    resolveAfterXSeconds(x) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(x);
            }, x * 1000);
        })
    }
    
    async componentDidMount() {
        this.df_event_query('Welcome');
        
        if (window.location.pathname === '/shop' && !this.state.shopWelcomeSent) {
            await this.resolveAfterXSeconds(1);
            this.df_event_query('WELCOME_SHOP');
            this.setState({ shopWelcomeSent: true, showBot: true });
        }

        this.props.history.listen(() => {
            if (this.props.history.location.pathname === '/shop' && !this.state.shopWelcomeSent) {
                this.df_event_query('WELCOME_SHOP');
                this.setState({ shopWelcomeSent: true, showBot: true });
            }
        });
    }

    componentDidUpdate() {
        this.messagesEnd.scrollIntoView({ behaviour: "smooth"});
        if ( this.talkInput ) {
            this.talkInput.focus();
        }
    }

    show(event) {
        event.preventDefault();
        event.stopPropagation();
        this.setState({showBot: true});
    }

    hide(event) {
        event.preventDefault();
        event.stopPropagation();
        this.setState({showBot: false});
    }

    _handleQuickReplyPayload(event, payload, text) {
        event.preventDefault();
        event.stopPropagation();

        switch (payload) {
            case 'recomendar_si':
                this.df_event_query('MOSTRAR_RECOMENDACIONES');
                break;
            case 'training_costos':
                this.df_event_query('COSTOS');
                break;
            default:
                this.df_text_query(text);
                break;
        }

    }

    renderCards(cards) {
        return cards.map((card, i) => <Card key={i} payload={card}/>);
    }


    renderOneMessage(message, i) {
        if (message.msg && message.msg.text && message.msg.text.text) {
            return <Message key={i} speaks={message.speaks} text={message.msg.text.text} />;

        } else if (message.msg && message.msg.payload
            && message.msg.payload.cards) { //message.msg.payload.fields.cards.listValue.values

            return <div key={i}>
                <div className="card-panel grey lighten-5 z-depth-1">
                    <div style={{overflow: 'hidden'}}>
                        <div className="col s2">
                            <a href="/" className="btn-floating btn-large waves-effect waves-light grey darken-3">{message.speaks}</a>
                        </div>
                        <div style={{overflow: 'auto', overflowY: 'scroll'}}>
                            <div style={{ height: 300, width:message.msg.payload.cards.length * 270}}>
                                {this.renderCards(message.msg.payload.cards)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        } else if (message.msg &&
            message.msg.payload &&
            message.msg.payload.quick_replies
        ) {
            return <QuickReplies
                text={message.msg.payload.text ? message.msg.payload.text : null}
                key={i}
                replyClick={this._handleQuickReplyPayload}
                speaks={message.speaks}
                payload={message.msg.payload.quick_replies}/>;
        } 
    }

    renderMessages(returnedMessages) {
        if (returnedMessages) {
            return returnedMessages.map((message, i) => {
                return this.renderOneMessage(message, i);  
            })
        } else {
            return null;
        }
    }
    
    _handleInputKeyPress(e){
        if (e.key === 'Enter') {
            this.df_text_query(e.target.value);
            e.target.value = '';
        }
    }

    render() {

    if(this.state.showBot) {
        return(
            <div style={{ minHeight: 500, maxHeight: 470, width:400, position: 'fixed', backgroundColor: 'white',  bottom: 0, right: 0, border: '1px solid lightgray', visibility: 'visible', zIndex: 2}}>
                <nav>
                    <div className="nav-wrapper light-green">
                        <a href="/" className="brand-logo">KoverBot</a>
                        <ul id="nav-mobile" className="right hide-on-med-and-down">
                            <li><a href="/" onClick={this.hide} className='cerrar'>Cerrar</a></li>
                        </ul>

                        <ul id="nav-mobile-cerrar" className="right hide-on-med-and-down-cerrar">
                            <li><a href="/" onClick={this.hide} className='cerrar-icono'><i class="bi bi-arrows-angle-contract right mobile-nav-toggle"></i></a></li>
                        </ul>


                    </div>
                </nav> 

                <div id="chatbot"  style={{ minHeight: 388, maxHeight: 388, width:'100%', overflow: 'auto'}}>
                    {this.renderMessages(this.state.messages)}
                    <div ref={(el) => { this.messagesEnd = el; }}
                        style={{ float: "left", clear: "both"}}>
                    </div>
                </div>
                <div className="col s12">
                    <input style={{margin: 0, paddingLeft: '1%', paddingRight: '1%', width: '98%'}} ref={(input) => { this.talkInput = input; }} placeholder="Escribe un mensaje:"  onKeyPress={this._handleInputKeyPress} id="user_says" type="text" />
                </div>

            </div>
            );
    } else {
        return(
            <div style={{ minHeight: 40, maxHeight: 500, width: 400, position: 'fixed', bottom: 0, right: 0, border: '1px solid lightgrey', visibility: 'visible', zIndex: 2}}>
                <nav>
                    <div className="nav-wrapper light-green">
                        <a href="/" className="brand-logo">KoverBot</a>
                        <ul id="nav-mobile" className="right hide-on-med-and-down">
                            <li><a href="/" onClick={this.show} className='mostrar'>Mostrar</a></li>
                        </ul>
                        
                        <ul id="nav-mobile-mostrar" className="right hide-on-med-and-down-mostrar">
                            <li><a href="/" onClick={this.show} className='mostrar'><i class="bi bi-arrows-angle-expand right mobile-nav-toggle"></i></a></li>
                        </ul>

                    </div>
                </nav> 
                <div ref={(el) => { this.messagesEnd = el; }}
                    style={{ float: "left", clear: "both"}}>
                </div> 
            </div>
            );
        }   
    }

}

export default withRouter(Chatbot);