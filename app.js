const AWS = require('aws-sdk');
const moment = require('moment');
var ddb = new AWS.DynamoDB();

var resetTimer = (channel,user,reason,callback) => {
    console.info('Resetting time since last #PSARandom encounter');
    let params = {
        ExpressionAttributeNames: {'#hl': 'history_list', "#u": 'user', '#lr': 'latest_reset', '#r': 'reason'},
        UpdateExpression: 'SET #hl = list_append(if_not_exists(#hl,:empty_list),:hlvals), #u = :u, #lr = :lr, #r = :r',
        ExpressionAttributeValues: {
            ':empty_list': {
                'L': []
            },
            ':hlvals': {
                'L': [
                    { 'N': `${Date.now()}` }
                ]
            },
            ':u': {
                S: user
            },
            ':lr': {
                 N: `${Date.now()}`
             },
             ':r': {
                S: reason
             }
        },
        TableName: 'unicorn-ttr',
        Key: {
            'logicalStore': {
                S: `${channel}#current_state`
            }
        },
        ReturnValues: 'ALL_OLD'
    }
    ddb.updateItem(params).promise()
        .then( data => {
            console.info('Successfully reset the counter');
            if ( typeof(data.Attributes) == 'undefined'){
                callback(null, {"response_type": "in_channel",text:`This has been the first reset for this channel by _${user}_`});
            }else{
                let duration = ((parseInt(data.Attributes['latest_reset']['N'])) - Date.now());
                let human = moment.duration(duration).humanize();
                callback(null,{"response_type": "in_channel",text:`_${user}_ reset the timer because: _*${reason}*_\nThis was a #PSARandom free channel for _*${human}*_\nThe previous encounter was reset by _${data.Attributes['user']['S']}_ because _*${data.Attributes['reason']['S']}*_`});
            }
        })
        .catch( err => {
            callback(err);
        })
}

var status = (channel,callback) => {
    console.info('Returning current duration since last #PSARandom encounter');
    let params = {
        TableName: 'unicorn-ttr',
        Key: {
            'logicalStore': {
                S: `${channel}#current_state`
            }
        }
    }
    ddb.getItem(params).promise()
        .then( (data) => {
            console.info(data);
            if(typeof(data.Item) == 'undefined'){
                callback(null,{"response_type": "in_channel", "text": "I am not tracking this channel yet. Please reset the channel to let me track it."})
                return;
            }
            let duration = ((parseInt(data.Item['latest_reset']['N'])) - Date.now());
            let human = moment.duration(duration).humanize();
            callback(null,{"response_type": "in_channel",text:`This has been a #PSARandom free zone for ${human}\nLast reset reason was _*${data.Item['reason']['S']}*_ set by _${data.Item['user']['S']}_`});
        })
        .catch( (err) => {
            callback(err);
        })
}

exports.handler = (event,context,callback) => {
    console.info('Received a request from Slack');
    console.info('Converting Event Text into Parsed Values')

    console.log(event.text.split(":"));

    let slackUser = `<@${event.user_id}|${event.user_name}>`

    let req = event.text.split(":")[0].trim()
    let reason = ( typeof(event.text.split(":")[1]) == 'undefined') ? '' : event.text.split(":")[1].trim() ;
    reason = (reason.length < 1) ? '' : reason
    switch(req){
        case 'reset':
            if( reason == '') {
                callback(null,'Please specify a reason for resetting the timer');
                break;
            }
            resetTimer(event.channel_id,slackUser,reason,callback);
            break;
        case 'status':
            status(event.channel_id,callback);
            break;
        default:
            callback(null,'Dave, what are you asking this poor dumb bot to do now?');
    }
}
