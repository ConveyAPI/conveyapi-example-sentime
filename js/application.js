
$(document).ready(function() {

	if (typeof(localStorage) != 'undefined' ) {
	  $("#apiKey").val(localStorage.getItem("apiKey"));
	}

	$('#buttonSaveSettings').click(function() {
		
		if (typeof(localStorage) != 'undefined' ) {
		  localStorage.setItem("apiKey", $("#apiKey").val());
		}

		$('#modalSettings').modal('hide');
	});

	$("#filterPositive").click(function () {$("blockquote.positive").toggle(); $("#filterPositive").toggleClass("badge-success");});
  $("#filterNegative").click(function () {$("blockquote.negative").toggle(); $("#filterNegative").toggleClass("badge-important");});
  $("#filterNeutral").click(function () {$("blockquote.neutral").toggle(); $("#filterNeutral").toggleClass("badge-warning");});
});





var apiUrl = "http://beta.conveyapi.com/analysis-engine/process?callback=?";
var searchUrl = "http://search.twitter.com/search.json?callback=?";
var totals = {};
var wordCounts = {};
var polarities = ["positive","negative","neutral"];
var searchTerms;
var annotatedTweets = [];
clear();

$("#submit").click(function () {
  if($("#apiKey").val().length < 5) {
    $('#modalSettings').modal('show');
  } else {
    var searchText = $("#terms").val();
    searchTerms = searchText.toLowerCase().split(/\b\s+/);
    search(searchText);
  }
});

$('#terms').keypress(function(event){
  if(event.keyCode == 13){
    $('#submit').click();
  }
});

$("#export").click(function () {
  exportCSV();
});

$("#clear").click(function () {
  clear();
});

function search(terms) {
  clear();
  $.getJSON(searchUrl,
    { q: terms, rpp: 100, result_type: "recent", lang: "en", max_id: null},
    function(jsonData) {
      var requests = $.map(jsonData.results, function(tweet){
        return process(tweet);
      });
      $.when.apply(null, requests).done(function() {
        drawChart();
        $.each(polarities, function(i,p) { 
          drawCloud(p);
        });
        $('#export').removeClass('disabled');
        $('#export').removeAttr('disabled');
     });
    });
}

function exportCSV() {
  var csvData = generateCSV();

  if (navigator.appName != 'Microsoft Internet Explorer') {
    window.open('data:text/csv;charset=utf-8;headers=Content-Disposition:attachment;filename=conveyapi_export.csv,' + escape(csvData));
  } else {
    var popupCSV = window.open('','conveyapi_export.csv','');
    popupCSV.document.body.innerHTML = '<pre>' + csvData + '</pre>';
  }
}

function generateCSV() {
  var colNames = [];
  var str = '';

  for (var colname in flatten(annotatedTweets[0])) {
    if (str != '') str += ',';
    str += "\"" + colname + "\"";
    colNames.push(colname);
  }
  str += '\r\n';
 
  $.map(annotatedTweets, function(tweet) {
    var line = '';
    var columns = flatten(tweet);
    $.each(colNames, function(k, v){
      if (line != '') line += ',';
      if (typeof(columns[v]) == "string") {
        line += "\"" + columns[v].replace(/\"/g, "\"\"") + "\"";
      } else {
        line += "\"" + columns[v] + "\"";
      }
    })
    str += line + '\r\n';
  });

  return str;
}

function flatten(data) {
    var flattenedData = {};
    var flattenFunc = function(key, value) {
      if (value != null && typeof(value) == 'object') {
        for (var item in value) {
          flattenFunc(key ? key + '.' + item : item, value[item]);
        }
      }
      else {
        flattenedData[key] = value;
      }
    };

    flattenFunc('', data);
    return flattenedData;
};

function process(tweet) {
  return $.getJSON(apiUrl,
    { api_key: $("#apiKey").val(), text: tweet.text},
    function(jsonData) {
      var annotations = jsonData.document.annotations;
      
      var annotationList = $("<dl class='dl-horizontal'/>");
      appendAnnotation(annotationList, "polarity", annotations.polarity);
      appendAnnotation(annotationList, "emotion", annotations.emotion);
      appendAnnotation(annotationList, "intensity", annotations.intensity);
      
      $("#tweets").append(
        $("<blockquote/>").addClass(annotations.polarity.value).append(
          $("<p/>").html(tweet.text),
            $("<small/>").append($("<strong/>").text(tweet.from_user_name), " @" + tweet.from_user + " on " + tweet.created_at),
              annotationList));

      collectWords(annotations.polarity.value, tweet.text);
      updateTotals(annotations.polarity.value);
      $.extend(tweet, annotations);
      annotatedTweets.push(tweet);
    });
}

var stopWords = ["a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at","be","because",
"been","before","being","below","between","both","but","by","could","couldn't","did","didn't","do","does","doesn't","doing","don't",
"down","during","each","few","for","from","further","had","hadn't","has","hasn't","have","haven't","having","he","he'd","he'll","he's",
"her","here","here's","hers","herself","him","himself","his","how","how's","http","i","i'd","i'll","i'm","i've","if","in","into","is","isn't",
"it","it's","its","itself","let's","me","more","most","mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other",
"ought","our","ours","ourselves","out","over","own","rt","same","shan't","she","she'd","she'll","she's","should","shouldn't","so","some",
"such","than","that","that's","the","their","theirs","them","themselves","then","there","there's","these","they","they'd","they'll","they're",
"they've","this","those","through","to","too","under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've","were","weren't",
"what","what's","when","when's","where","where's","which","while","who","who's","whom","why","why's","with","won't","would","wouldn't","you",
"you'd","you'll","you're","you've","your","yours","yourself","yourselves"];

function collectWords(polarity, text) {

	var polarityCounts = wordCounts[polarity];

	var badCharPattern = /[^a-zA-Z'\-]+/g;
  var urlPattern = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
  var htmlEntity = /&[^\s]*;/
 
	text = text = text.replace(urlPattern, " ")
    .replace(htmlEntity, " ")
    .replace(badCharPattern, " ")
    .replace(/^\s+/,"")
    .replace(/\s+$/,"");

	var words = text.split(/\b\s+/);
	$.each(words, function(i,word){
		var wordLower = word.toLowerCase()
		if(($.inArray(wordLower, stopWords) == -1) && ($.inArray(wordLower, searchTerms) == -1)) {
		  var count = polarityCounts[word];
		  polarityCounts[word] = isNaN(count) ? 1 : count + 1;
		}
	});
}

function updateTotals(polarity){
  if(polarity != null){	
    totals[polarity]++;
  }
  
  var totalTweets = 0;
  $.each(polarities, function(i,p) {
    totalTweets += totals[p];
  });

  $.each(polarities, function(i,p) {
  	var percent = totalTweets > 0 ? (100 * totals[p] / totalTweets).toFixed(0) : 0;
    $("#" + p + "Count").text(totals[p] + " (" + percent + "%)");
  });
}

function appendAnnotation(list, name, annotation) {
  
  var span = $("<span class='label'/>");
  
  switch(annotation.value) {
    case "positive": 
      span.addClass("label-success");
      break;
    case "neutral": 
      span.addClass("label-warning");
      break;
    case "negative": 
      span.addClass("label-important");
      break;
  }
  
  list.append(
    $("<dt/>").text(name + ":"),
    $("<dd/>").append(span.append(annotation.value + 
     " (" + annotation.confidence.toFixed(2) + ")")));
}

function clear() {
  $.each(polarities, function(i,p) {
    totals[p] = 0;
    wordCounts[p] = {};
    d3.select("#cloud" + p).select("svg").remove();
  });

  updateTotals(null);

  $("#tweets").empty();
  d3.select("#chartPolarity").select("svg").remove();

  $("#filterPositive").addClass("badge-success");
  $("#filterNegative").addClass("badge-important");
  $("#filterNeutral").addClass("badge-warning");

  $('#export').attr('disabled', 'disabled');
  $('#export').addClass('disabled');
}

function drawCloud(polarity) {

	var colors = {"positive": "#468847", "negative": "#b94a48", "neutral": "#f89406"};
	var color = colors[polarity];

	var words = [];
	var maxCount = 0;
	var polarityCounts = wordCounts[polarity];
	for(var word in polarityCounts){
		var count = polarityCounts[word];
		words.push({text: word, size: count});
		maxCount = Math.max(maxCount, count);
	}

	d3.layout.cloud().size([500, 500])
      .words(words)
      .rotate(function(d) { return ~~(Math.random() * 5) * 30 - 60; })
      .fontSize(function(d) { return d.size * 100 / maxCount; })
      .font("Impact")
      .on("end", draw)
      .start();

  function draw(words) {
    d3.select("#cloud" + polarity).append("svg")
        .attr("width", 500)
        .attr("height", 500)
        .attr("style", "display: block; margin-left: auto; margin-right: auto;")
      .append("g")
        .attr("transform", "translate(250,250)")
      .selectAll("text")
        .data(words)
      .enter().append("text")
        .style("font-size", function(d) { return d.size + "px"; })
        .style("font-family", function(d) { return d.font; })
        .style("fill", color) 
        .attr("text-anchor", "middle")
        .attr("transform", function(d) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        })
        .text(function(d) { return d.text; });
    }
}


function drawChart() {

  var colors = ["rgba(70, 136, 71, .75)", "rgba(185, 74, 72, .75)", "rgba(248, 148, 6, .75)"];
  var totalTweets = 0;
  $.each(polarities, function(i,p) {
    totalTweets += totals[p];
  });

  var width = 300,
      height = 300,
      outerRadius = Math.min(width, height) / 2,
      innerRadius = 0,
      data = $.map(polarities, function(p){ return totals[p]/totalTweets;}),
      donut = d3.layout.pie(),
      arc = d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius);

  var vis = d3.select("#chartPolarity")
    .append("svg")
      .data([data])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "display: block; margin-left: auto; margin-right: auto;");

  var arcs = vis.selectAll("g.arc")
      .data(donut)
    .enter().append("g")
      .attr("class", "arc")
      .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")");

  arcs.append("path")
      .attr("fill", function(d, i) { return colors[i]; })
      .attr("d", arc);

  arcs.append("text")
      .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .style("font-family", "Impact")
      .attr("display", function(d) { return d.value > .15 ? null : "none"; })
      .text(function(d, i) { return polarities[i]; });
}
			