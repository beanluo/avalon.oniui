define(["avalon.getModel","text!./avalon.daterangepicker.html", "datepicker/avalon.datepicker"], function(avalon, sourceHTML) {
    var arr = sourceHTML.split("MS_OPTION_STYLE") || ["", ""],  
        calendarTemplate = arr[0],
        cssText = arr[1].replace(/<\/?style>/g, ""), // 组件的css
        styleEl = document.getElementById("avalonStyle");
    try {
        styleEl.innerHTML += cssText;
    } catch (e) {
        styleEl.styleSheet.cssText += cssText;
    }
    var widget = avalon.ui.daterangepicker = function(element, data, vmodels) {
        var options = data.daterangepickerOptions,
            inputFrom, //绑定datepicker组件的初始日期输入域元素的引用
            inputTo, //绑定datepicker组件的结束日期输入域元素的引用
            disabled = options.disabled.toString(), //组件的配置项，可能是Boolean类型也可能代表一个属性变量名的字符串，通过此属性来决定组件的禁用与否
            disabledVM = avalon.getModel(disabled, vmodels),
            duplex = options.duplex && options.duplex.split(","), //options.duplex保存起始日期和结束日期初始化值的引用，逗号分隔
            rules = options.rules, //日期选择框起始日期和结束日期之间关系的规则
            selectFuncVM = typeof options.select ==="string" ? avalon.getModel(options.select, vmodels) : null, //得到select回调所在的VM域select值所组成的数组
            _confirmClick = false, //判断是否点击了确定按钮，没点击为false，点击为true
            _oldValue, //保存最近一次选择的起始日期和结束日期组成的日期对象数组，因为当选择了日期但没有点确定按钮时，日期选择范围不改变，相应的对应的日历默认输入域也应该恢复到最近一次的选择
            _toMinDate = "", //保存rules指向的对象的toMinDate属性值，以便于rules属性计算所得的minDate做比较
            _toMaxDate = ""; //保存rules指向的对象的toMaxDate属性值，以便于rules属性计算所得的maxDate做比较
        // 结束日期初始异常时默认日期、起始日期和结束日期最小相隔天数、最大相隔天数的设定形式的转化处理
        var _c = {  
            '+M': function(time ,n) { //+M表示相隔n个月
                var _d = time.getDate();
                time.setMonth(time.getMonth() + n);
                if(time.getDate() !== _d) {
                    time.setDate(0)
                } 
            },
            '-M': function(time ,n) { //-M表示相隔n个月不过是追溯到以前的日前
                var _d = time.getDate();
                time.setMonth(time.getMonth() - n);
                if(time.getDate() !== _d) {
                    time.setDate(0)
                }
            },
            '+D': function(time ,n) { 
                time.setDate(time.getDate() + n); 
            },
            '-D': function(time ,n) { 
                time.setDate(time.getDate() - n); 
            },
            '+Y': function(time ,n) { 
                time.setFullYear(time.getFullYear() + n); 
            },
            '-Y': function(time ,n) { 
                time.setFullYear(time.getFullYear() - n); 
            }
        };
        options.template = options.getTemplate(calendarTemplate, options);
        // 获取用户定义的模拟输入框显示内容形式的方法
        if(options.opts && options.opts.datesDisplayFormat && typeof options.opts.datesDisplayFormat ==="function") {
            options.datesDisplayFormat = options.opts.datesDisplayFormat;
        }
        // 获取rules配置对象
        if(rules && avalon.type(rules) === 'string') {
            var ruleVM = avalon.getModel(options.rules, vmodels);
            rules = ruleVM[1][ruleVM[0]];
        }
        rules = rules.$model || rules;
        _toMinDate = rules.toMinDate; 
        _toMaxDate = rules.toMaxDate; 
        // 让rules对象的toMinDate、toMaxDate、fromMinDate、fromMaxDate是可监控的属性
        if(rules) {
            rules.toMinDate = rules.toMinDate || "";
            rules.toMaxDate = rules.toMaxDate || "";
            rules.fromMinDate = rules.fromMinDate || "";
            rules.fromMaxDate = rules.fromMaxDate || "";
        }
        options.rules = rules;
        if(selectFuncVM) {
            options.select = selectFuncVM[1][selectFuncVM[0]];
        }
        // 如果disabled配置为字符串，说明是通过外部vm控制组件的禁用与否，取得外部disabled所在vm并监控
        if(disabled!=="true" && disabled!=="false" && disabledVM) {
            options.disabled = disabledVM[1][disabledVM[0]];
            disabledVM[1].$watch(disabledVM[0], function(val) {
                vmodel.disabled = val;
            })
        }
        var rangeRules = options.rules && options.rules.rules || "";
        rangeRules = rangeRules.length>0 ? rangeRules.split(",") : [];
        var vmodel = avalon.define(data.daterangepickerId, function(vm) {
            avalon.mix(vm, options);
            vm.msg = "";
            vm.$skipArray = ["widgetElement","container","inputElement","calendarWrapper"];
            vm.widgetElement = element;
            vm.toggle = false;
            vm.container = null;
            vm.inputElement = null;
            vm.calendarWrapper = null;
            vm.value = "";
            vm.inputFromValue = ""
            vm.inputToValue = "";
            // 切换组件的显示隐藏
            vm._toggleDatepicker = function(val, event) {
                if(!vmodel.disabled) {
                    vmodel.toggle = !val;
                }
            }
            // 更新日期范围选择框下方的说明文字
            vm._updateMsg = function(event) {
                var target = event.target;
                if(target.tagName === "TD") {
                    updateMsg();
                }
            }
            // 点击确定按钮确定日期选择范围
            vm._selectDate = function() {
                var inputFromValue = inputFrom.value,
                    inputToValue = inputTo.value,
                    inputFromDate = options.parseDate(inputFromValue),
                    inputToDate = options.parseDate(inputToValue);
                vmodel.label = options.datesDisplayFormat(options.defaultLabel,inputFromValue, inputToValue);
                _confirmClick = true;
                vmodel.toggle = false;
                options.select.call(vmodel, inputFromDate, inputToDate, _oldValue, vmodel, avalon(element).data());
                _oldValue = [inputFromDate, inputToDate];
            }
            // 点击取消按钮隐藏日历框
            vm._cancelSelectDate = function() {
                vmodel.toggle ? vmodel.toggle = false: 0;
            }
            // 设置日期范围框的起始日期和结束日期
            vm.setDates = function(from, to, defaultLabel) {
                var inputValues = to === void 0 ? [from] : [from, to],
                    len = inputValues.length;
                if(len) {
                    vmodel.defaultLabel = defaultLabel;
                    setValues(len, from, to);
                } else {
                    vmodel.label = "";
                }
                initMsgAndOldValue();
            }
            // 设置日期输入框的label
            vm.setLabel = function(str) {
                vmodel.label = str;
            }
            // 设置日历的禁用与否
            vm.setDisabled = function(val) {
                vmodel.disabled = val;
            }
            // 选择了初始日期之后根据rules的设置及时更新结束日期的选择范围
            vm.fromSelectCal = function(date) {
                applyRules(date);
            }
            vm.$init = function() {
                options.template = options.template.replace(/MS_OPTION_START_DAY/g, vmodel.startDay);
                var daterangepicker = avalon.parseHTML(options.template).firstChild,
                    inputs = daterangepicker.getElementsByTagName("input"),
                    container = daterangepicker.children[0],
                    calendarWrapper = daterangepicker.children[1];
                inputFrom = inputs[0];
                inputTo = inputs[1];
                vmodel.container = container; 
                vmodel.inputElement = container;
                vmodel.calendarWrapper = calendarWrapper;   
                element.appendChild(daterangepicker);
                initValues();
                applyRules(vmodel.inputFromValue && options.parseDate(vmodel.inputFromValue) || new Date());
                avalon.scan(element, [vmodel].concat(vmodels)); 
                // 扫描完daterangepicker组件之后才扫描datepicker
                avalon.nextTick(function() {
                    inputFrom.setAttribute("ms-widget", "datepicker");
                    inputTo.setAttribute("ms-widget", "datepicker");
                    inputFrom.setAttribute("ms-duplex", "inputFromValue");
                    inputTo.setAttribute("ms-duplex", "inputToValue");
                    inputFrom.setAttribute("data-toggle", "toggle");
                    inputTo.setAttribute("data-toggle","toggle");
                    avalon.scan(inputFrom, [vmodel]);
                    avalon.scan(inputTo, [vmodel]);
                })
            }
            vm.$remove = function() {
                element.innerHTML = element.textContent = "";
            }
        })
        // 初始化日期范围值
        function initValues() {
            if(duplex) {
                var duplexLen = duplex.length,
                    duplexVM1 = avalon.getModel(duplex[0].trim(), vmodels),
                    duplexVM2 = duplexLen === 1 ? null : avalon.getModel(duplex[1].trim(), vmodels),
                    duplexVal1 = duplexVM1[1][duplexVM1[0]],
                    duplexVal2 = duplexVM2 ? duplexVM2[1][duplexVM2[0]] : "";
                setValues(duplexLen, duplexVal1, duplexVal2);
                vmodel.label =  options.label ? options.label : vmodel.label;
                initMsgAndOldValue();
            } 
        }
        // 根据参数个数进行日期的初始日期设置
        function setValues(len, from, to) {
            if(len) {
                if(len==2) {
                    vmodel.inputFromValue = inputFrom.value = from && options.parseDate(from) && from || "";
                    vmodel.inputToValue = inputTo.value = to && options.parseDate(to) && to || "";
                    vmodel.label = options.datesDisplayFormat(options.defaultLabel,vmodel.inputFromValue, vmodel.inputToValue);
                } else if(len==1){
                    vmodel.inputFromValue = inputFrom.value = from && options.parseDate(from) && from || "";
                }
                if(!vmodel.inputToValue) { // 只要inputTo.value为null都提示不限日期
                    vmodel.label = "不限日期";
                }
            }
        }
        // 根据rules的设置确定结束日期可选的范围及默认值
        function applyRules(date) {
            var df = {},
                rules = vmodel.rules;
            for(var i = 0 , type = ['defaultDate', 'minDate', 'maxDate'] ; i < type.length ; i++){
                if (rangeRules[i]) {
                    df[type[i]] = calcDate(rangeRules[i], date);
                }
            }
            var minDate = _toMinDate && options.parseDate(_toMinDate), 
                maxDate = _toMaxDate && options.parseDate(_toMaxDate),
                minDateRule = df['minDate'],
                maxDateRule = df['maxDate'];
            minDate = (minDateRule ? minDateRule.getTime() : -1) > (minDate ? minDate.getTime() : -1) ? minDateRule : minDate ;
            maxDate = (maxDateRule ? maxDateRule.getTime() : Number.MAX_VALUE) > (maxDate ? maxDate.getTime() : Number.MAX_VALUE) ? maxDate : maxDateRule;
            if(!vmodel.inputToValue && df["defaultDate"]){
                vmodel.inputToValue = options.formatDate(df["defaultDate"]);
            }
            if(minDate){
                var toMinDateFormat = options.formatDate(minDate);
                vmodel.rules.toMinDate = toMinDateFormat;
                if(!vmodel.inputToValue) {
                    vmodel.inputToValue = toMinDateFormat;
                }
            }
            if(maxDate) {
                vmodel.rules.toMaxDate = options.formatDate(maxDate);
            }
            var inputToDate = vmodel.inputToValue && vmodel.parseDate(vmodel.inputToValue);
            if(inputToDate && isDateDisabled(inputToDate, minDate, maxDate)) {
                vmodel.inputToValue = toMinDateFormat;
            }
        }
        // 根据minDate和maxDate的设置判断给定的日期是否不可选
        function isDateDisabled(date, minDate, maxDate){
            var time = date.getTime();
            if(minDate && time < minDate.getTime()){
                return true;
            } else if(maxDate && time > maxDate.getTime()) {
                return true;
            }
            return false;
        }
        // 解析rules.rules属性，得到正确的日期值
        function calcDate( desc , date ){
            var time;
            desc = ( desc || "" ).toString();
            time = date ? date : new Date();
            var _date = new Date(time);
            var re = /([+-])?(\d+)([MDY])?/g , 
                arr = re.exec(desc),
                key = arr && ((arr[1] || '+') + (arr[3] || 'D'));
            if(key && _c[key]){
                _c[key](_date ,arr[2] * 1);
            }
            return _date;
        }
        function initMsgAndOldValue() {
            _oldValue = [options.parseDate(inputFrom.value), options.parseDate(inputTo.value)];

            if(vmodel.label) {
                updateMsg();
            }
        }
        // 根据选择的日期更新日历框下方的显示内容
        function updateMsg() {
            var msg = "",
                day = 0,
                inputToDate = options.parseDate(inputTo.value),
                msgFormat = options.opts && options.opts.msgFormat;
            if(inputTo.value && !inputToDate) {
                vmodel.inputToValue = "";
            } 
            if(inputTo.value && inputFrom.value) {
                day = Math.floor(((inputToDate.getTime()-options.parseDate(inputFrom.value).getTime()))/1000/60/60/24 +1);
                if(msgFormat && typeof msgFormat === "function") {
                    var from = {
                            getRawValue: function() {
                                return inputFrom.value;
                            },
                            getDate: function() {
                                return options.parseDate(inputFrom.value) || cleanDate(new Date());
                            }
                        },
                        to = {
                            getRawValue: function() {
                                return inputTo.value;
                            },
                            getDate: function() {
                                return inputToDate;
                            }
                        };
                    msg = options.opts.msgFormat(from, to);
                } else {
                    msg = "已选时间段："+inputFrom.value+" 至 "+inputTo.value+" 共计"+day+"天";
                }
                vmodel.msg = msg;
            }
        }
        // 将日期时间转为00:00:00
        function cleanDate( date ){
            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);
            return date;
        }
        vmodel.$watch("toggle", function(val) {
            if(!val && !_confirmClick) {
                inputFrom.value = vmodel.inputFromValue;
                inputTo.value = vmodel.inputToValue;
            } else if(_confirmClick){
                vmodel.inputFromValue = inputFrom.value;
                vmodel.inputToValue = inputTo.value;
                _confirmClick = false;
            }
        })
        return vmodel;
    }
    widget.version = 1.0
    widget.defaults = {
        fromLabel : '选择起始日期',
        toLabel : '选择结束日期',
        rules: "",
        label: "", //范围选择框的日历说明
        defaultLabel: "日期范围",
        disabled: false,
        widgetElement: "", // accordion容器
        separator: "-",
        startDay: 1,    //星期开始时间
        select: avalon.noop, //点击确定按钮选择日期后的回调
        parseDate: function(str){
            var separator = this.separator;
            var reg = "^(\\d{4})" + separator+ "(\\d{1,2})"+ separator+"(\\d{1,2})$";
            reg = new RegExp(reg);
            var x = str.match(reg);
            return x ? new Date(x[1],x[2] * 1 -1 , x[3]) : null;
        },
        formatDate: function(date){
            var separator = this.separator,
                year = date.getFullYear(), 
                month = date.getMonth(), 
                day = date.getDate();
            return year + separator + this.formatNum( month + 1 , 2 ) + separator + this.formatNum( day , 2 );
        },
        formatNum: function(n , length){
            n = String(n);
            for( var i = 0 , len = length - n.length ; i < len ; i++)
                n = "0" + n;
            return n;
        },
        datesDisplayFormat: function(label, fromDate, toDate) {
            return label + "：" + fromDate + ' 至 ' + toDate;
        },
        getTemplate: function(str, options) {
            return str;
        }
    }
    return avalon;
})